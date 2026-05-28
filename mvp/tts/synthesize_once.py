import argparse
import json
import os
import time
from pathlib import Path

import numpy as np
import soundfile as sf

TTS_DIR = Path(__file__).resolve().parent
MVP_DIR = TTS_DIR.parent
MODEL_CACHE = MVP_DIR / ".model-cache"
MODEL_PATH = TTS_DIR / "models" / "kokoro" / "kokoro-v1.0.onnx"
VOICES_PATH = TTS_DIR / "models" / "kokoro" / "voices-v1.0.bin"
DEFAULT_QWEN_TTS_MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-5bit"
DEFAULT_QWEN_TTS_OFFICIAL_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"


def ensure_project_cache_env():
    """把模型下载和运行缓存固定在项目目录内。"""
    env_defaults = {
        "HF_HOME": MODEL_CACHE / "huggingface",
        "HF_HUB_CACHE": MODEL_CACHE / "huggingface" / "hub",
        "HUGGINGFACE_HUB_CACHE": MODEL_CACHE / "huggingface" / "hub",
        "TORCH_HOME": MODEL_CACHE / "torch",
        "XDG_CACHE_HOME": MODEL_CACHE / "xdg",
        "MLX_CACHE_DIR": MODEL_CACHE / "mlx",
        "PIP_CACHE_DIR": MODEL_CACHE / "pip",
        "UV_CACHE_DIR": MODEL_CACHE / "uv",
        "MODELSCOPE_CACHE": MODEL_CACHE / "modelscope",
    }
    for key, value in env_defaults.items():
        os.environ.setdefault(key, str(value))
        Path(os.environ[key]).mkdir(parents=True, exist_ok=True)
    os.environ.pop("TRANSFORMERS_CACHE", None)


def softened(audio, sample_rate):
    audio = np.asarray(audio, dtype=np.float32)
    if audio.size == 0 or not sample_rate:
        return audio

    gain = 0.78
    fade_in = min(int(sample_rate * 0.045), len(audio))
    fade_out = min(int(sample_rate * 0.16), len(audio))
    lead = np.zeros((int(sample_rate * 0.07),) + audio.shape[1:], dtype=np.float32)
    tail = np.zeros((int(sample_rate * 0.18),) + audio.shape[1:], dtype=np.float32)

    if fade_in > 1:
        curve = np.linspace(0.0, 1.0, fade_in, dtype=np.float32)
        audio[:fade_in] *= curve[:, None] if audio.ndim > 1 else curve
    if fade_out > 1:
        curve = np.linspace(1.0, 0.0, fade_out, dtype=np.float32)
        audio[-fade_out:] *= curve[:, None] if audio.ndim > 1 else curve

    return np.concatenate([lead, np.clip(audio * gain, -1.0, 1.0), tail])


def synthesize_kokoro(text, voice, speed, lang):
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(str(MODEL_PATH), str(VOICES_PATH))
    audio, sample_rate = kokoro.create(
        text,
        voice=voice,
        speed=speed,
        lang=lang,
    )
    return softened(audio, sample_rate), sample_rate


def result_audio(result):
    if hasattr(result, "audio"):
        return result.audio
    if isinstance(result, dict) and "audio" in result:
        return result["audio"]
    return result


def result_sample_rate(result, fallback=24000):
    for attr in ["sample_rate", "sampleRate", "sampling_rate", "sr"]:
        if hasattr(result, attr):
            return int(getattr(result, attr))
        if isinstance(result, dict) and attr in result:
            return int(result[attr])
    return fallback


def synthesize_qwen3_tts_mlx(text, model_id, language, instruct):
    from mlx_audio.tts.utils import load_model

    model = load_model(model_id)
    if hasattr(model, "generate_voice_design"):
        results = list(
            model.generate_voice_design(
                text=text,
                language=language,
                instruct=instruct,
            )
        )
    elif hasattr(model, "generate_custom_voice"):
        results = list(
            model.generate_custom_voice(
                text=text,
                language=language,
                speaker="Aiden",
                instruct=instruct,
            )
        )
    else:
        results = list(model.generate(text=text))

    if not results:
        raise RuntimeError("Qwen3-TTS did not return audio.")
    first = results[0]
    audio = np.asarray(result_audio(first), dtype=np.float32)
    return softened(audio, result_sample_rate(first)), result_sample_rate(first)


def synthesize_qwen3_tts_official(text, model_id, language, instruct):
    import torch
    from qwen_tts import Qwen3TTSModel

    if torch.cuda.is_available():
        device_map = "cuda:0"
        dtype = torch.bfloat16
        extra = {"attn_implementation": "flash_attention_2"}
    elif torch.backends.mps.is_available():
        device_map = "mps"
        dtype = torch.float16
        extra = {}
    else:
        device_map = "cpu"
        dtype = torch.float32
        extra = {}

    model = Qwen3TTSModel.from_pretrained(
        model_id,
        device_map=device_map,
        dtype=dtype,
        **extra,
    )
    wavs, sample_rate = model.generate_voice_design(
        text=text,
        language=language,
        instruct=instruct,
    )
    audio = np.asarray(wavs[0], dtype=np.float32)
    return softened(audio, sample_rate), sample_rate


def main():
    ensure_project_cache_env()
    parser = argparse.ArgumentParser(description="Create one local TTS wav file.")
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--engine", default=os.environ.get("TTS_ENGINE", "kokoro_onnx"))
    parser.add_argument("--model", default=os.environ.get("TTS_MODEL", DEFAULT_QWEN_TTS_OFFICIAL_MODEL))
    parser.add_argument("--voice", default="af_nicole")
    parser.add_argument("--speed", type=float, default=0.68)
    parser.add_argument("--lang", default="en-us")
    parser.add_argument("--language", default=os.environ.get("TTS_LANGUAGE", "English"))
    parser.add_argument(
        "--instruct",
        default=os.environ.get(
            "TTS_INSTRUCT",
            "A calm intimate adult female voice, low volume, slow breath-paced delivery, soft but slightly mechanical.",
        ),
    )
    args = parser.parse_args()

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    started = time.perf_counter()
    if args.engine == "qwen3_tts_official":
        audio, sample_rate = synthesize_qwen3_tts_official(args.text, args.model, args.language, args.instruct)
    elif args.engine == "qwen3_tts_mlx":
        audio, sample_rate = synthesize_qwen3_tts_mlx(args.text, args.model, args.language, args.instruct)
    elif args.engine == "kokoro_onnx":
        audio, sample_rate = synthesize_kokoro(args.text, args.voice, args.speed, args.lang)
    else:
        raise ValueError(f"Unsupported TTS engine: {args.engine}")

    sf.write(str(output_path), audio, sample_rate)
    synth_s = time.perf_counter() - started
    duration_s = float(len(audio) / sample_rate) if sample_rate else 0

    print(
        json.dumps(
            {
                "engine": args.engine,
                "model": args.model if args.engine.startswith("qwen3_tts") else None,
                "voice": args.voice if args.engine == "kokoro_onnx" else "voice-design",
                "language": args.language if args.engine.startswith("qwen3_tts") else args.lang,
                "instruct": args.instruct if args.engine.startswith("qwen3_tts") else None,
                "output": str(output_path),
                "sampleRate": sample_rate,
                "durationSeconds": round(duration_s, 4),
                "synthSeconds": round(synth_s, 4),
            },
            ensure_ascii=True,
        )
    )


if __name__ == "__main__":
    main()
