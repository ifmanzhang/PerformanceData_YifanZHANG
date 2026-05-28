import json
import platform
import statistics
import subprocess
import time
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
TTS_DIR = ROOT / "mvp" / "tts"
OUT_DIR = TTS_DIR / "output"
KOKORO_MODEL = TTS_DIR / "models" / "kokoro" / "kokoro-v1.0.onnx"
KOKORO_VOICES = TTS_DIR / "models" / "kokoro" / "voices-v1.0.bin"
PIPER_MODEL = TTS_DIR / "models" / "piper" / "en_US-lessac-high.onnx"
PIPER_CONFIG = TTS_DIR / "models" / "piper" / "en_US-lessac-high.onnx.json"

TEST_LINES = [
    "You do not need to do anything.",
    "Let the breath arrive.",
    "Stay where you are.",
    "You may stop trying.",
]


def duration_seconds(path: Path) -> float:
    info = sf.info(str(path))
    return float(info.frames / info.samplerate)


def summarize_runs(runs):
    synth_times = [run["synth_s"] for run in runs]
    rtfs = [run["rtf"] for run in runs if run["rtf"] is not None]
    return {
        "runs": len(runs),
        "avg_synth_s": round(statistics.mean(synth_times), 4),
        "median_synth_s": round(statistics.median(synth_times), 4),
        "min_synth_s": round(min(synth_times), 4),
        "max_synth_s": round(max(synth_times), 4),
        "avg_audio_duration_s": round(statistics.mean(run["audio_duration_s"] for run in runs), 4),
        "avg_rtf": round(statistics.mean(rtfs), 4) if rtfs else None,
    }


def benchmark_macos_say():
    runs = []
    engine_dir = OUT_DIR / "macos_say_samantha"
    engine_dir.mkdir(parents=True, exist_ok=True)

    for index, text in enumerate(TEST_LINES, start=1):
        out_path = engine_dir / f"{index:02d}.aiff"
        started = time.perf_counter()
        subprocess.run(
            [
                "say",
                "-v",
                "Samantha",
                "-o",
                str(out_path),
                text,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        synth_s = time.perf_counter() - started
        audio_duration_s = duration_seconds(out_path)
        runs.append(
            {
                "text": text,
                "output": str(out_path.relative_to(ROOT)),
                "synth_s": round(synth_s, 4),
                "audio_duration_s": round(audio_duration_s, 4),
                "rtf": round(synth_s / audio_duration_s, 4) if audio_duration_s else None,
            }
        )

    return {
        "engine": "macos_say",
        "voice": "Samantha",
        "load_s": 0,
        "cold_first_total_s": runs[0]["synth_s"],
        "runs": runs,
        "summary": summarize_runs(runs),
    }


def benchmark_kokoro(voice: str):
    from kokoro_onnx import Kokoro

    engine_dir = OUT_DIR / f"kokoro_{voice}"
    engine_dir.mkdir(parents=True, exist_ok=True)

    load_started = time.perf_counter()
    kokoro = Kokoro(str(KOKORO_MODEL), str(KOKORO_VOICES))
    load_s = time.perf_counter() - load_started

    runs = []
    for index, text in enumerate(TEST_LINES, start=1):
        out_path = engine_dir / f"{index:02d}.wav"
        started = time.perf_counter()
        audio, sample_rate = kokoro.create(text, voice=voice, speed=0.82, lang="en-us")
        sf.write(str(out_path), audio, sample_rate)
        synth_s = time.perf_counter() - started
        audio_duration_s = duration_seconds(out_path)
        runs.append(
            {
                "text": text,
                "output": str(out_path.relative_to(ROOT)),
                "synth_s": round(synth_s, 4),
                "audio_duration_s": round(audio_duration_s, 4),
                "rtf": round(synth_s / audio_duration_s, 4) if audio_duration_s else None,
            }
        )

    return {
        "engine": "kokoro_onnx",
        "voice": voice,
        "load_s": round(load_s, 4),
        "cold_first_total_s": round(load_s + runs[0]["synth_s"], 4),
        "runs": runs,
        "summary": summarize_runs(runs),
    }


def benchmark_piper():
    from piper import PiperVoice, SynthesisConfig

    engine_dir = OUT_DIR / "piper_lessac_high"
    engine_dir.mkdir(parents=True, exist_ok=True)

    load_started = time.perf_counter()
    voice = PiperVoice.load(PIPER_MODEL, config_path=PIPER_CONFIG)
    load_s = time.perf_counter() - load_started
    config = SynthesisConfig(length_scale=1.18, noise_scale=0.58, noise_w_scale=0.72)

    runs = []
    for index, text in enumerate(TEST_LINES, start=1):
        out_path = engine_dir / f"{index:02d}.wav"
        started = time.perf_counter()
        chunks = list(voice.synthesize(text, syn_config=config))
        audio_data = np.concatenate([chunk.audio_float_array for chunk in chunks])
        sample_rate = chunks[0].sample_rate
        sf.write(str(out_path), audio_data, sample_rate)
        synth_s = time.perf_counter() - started
        audio_duration_s = duration_seconds(out_path)
        runs.append(
            {
                "text": text,
                "output": str(out_path.relative_to(ROOT)),
                "synth_s": round(synth_s, 4),
                "audio_duration_s": round(audio_duration_s, 4),
                "rtf": round(synth_s / audio_duration_s, 4) if audio_duration_s else None,
            }
        )

    return {
        "engine": "piper",
        "voice": "en_US-lessac-high",
        "load_s": round(load_s, 4),
        "cold_first_total_s": round(load_s + runs[0]["synth_s"], 4),
        "runs": runs,
        "summary": summarize_runs(runs),
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "machine": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        },
        "texts": TEST_LINES,
        "engines": [
            benchmark_macos_say(),
            benchmark_kokoro("af_bella"),
            benchmark_kokoro("af_heart"),
            benchmark_piper(),
        ],
    }

    result_path = TTS_DIR / "benchmark_results.json"
    result_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
