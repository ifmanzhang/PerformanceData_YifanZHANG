#!/usr/bin/env python3
"""预生成睡眠助手文本和对应 TTS 音频。

用途：
- 报告、示例视频、portfolio 使用高质量缓存语音。
- 现场演出优先读取 `mvp/tts/precomputed/manifest.json`，缺失时再实时生成。

所有模型缓存会被固定到项目目录内。
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MVP_DIR = ROOT / "mvp"
MODEL_CACHE = MVP_DIR / ".model-cache"
PRECOMPUTED_DIR = MVP_DIR / "tts" / "precomputed"
SYNTH_SCRIPT = MVP_DIR / "tts" / "synthesize_once.py"

DEFAULT_LLM_MODEL = "qwen3.5:27b"
DEFAULT_TTS_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
DEFAULT_INSTRUCT = (
    "A calm intimate adult female voice, low volume, slow breath-paced delivery, "
    "soft but slightly mechanical, precise articulation, not cheerful."
)

STAGES = {
    "calm": {
        "pressure": "low",
        "intent": "quiet arrival, permission, no bodily instruction",
        "fallback": [
            "You do not need to do anything.",
            "Let quiet arrive by itself.",
            "Nothing has to be proven.",
            "Stay soft for a moment.",
            "The room can hold you.",
            "Let the body be slower.",
        ],
    },
    "guidance": {
        "pressure": "low",
        "intent": "gentle invitation that feels slightly directive, without breathing commands",
        "fallback": [
            "Try not to try.",
            "Do less than before.",
            "Let the quiet find you.",
            "The signal waits softly.",
            "A small rule opens.",
            "Let the room answer slowly.",
        ],
    },
    "evaluation": {
        "pressure": "medium",
        "intent": "soft assessment without numbers, helpful but slightly controlling",
        "fallback": [
            "There is nothing to improve.",
            "Soften the effort.",
            "Let stillness become easier.",
            "You are nearly quiet.",
            "Release the extra trying.",
            "Rest more evenly now.",
        ],
    },
    "overload": {
        "pressure": "high",
        "intent": "system overconfidence, calm surface with hidden pressure, no bodily risk",
        "fallback": [
            "Rest without proving it.",
            "Almost quiet now.",
            "Stay with the quiet.",
            "No need to force it.",
            "The loop softens at the edge.",
            "The signal narrows without harm.",
        ],
    },
    "ending": {
        "pressure": "low",
        "intent": "permission to stop obeying the system and leave the quiet",
        "fallback": [
            "I am still here.",
            "You may stop trying.",
            "The measure can end.",
            "Let the rule fall away.",
            "You can leave the quiet.",
            "No answer is needed.",
        ],
    },
}

FORBIDDEN = [
    "data",
    "baseline",
    "score",
    "metric",
    "stage",
    "pressure",
    "heart",
    "pulse",
    "medical",
    "diagnosis",
    "panic",
    "symptom",
    "walk",
    "move",
    "dance",
    "inhale",
    "exhale",
    "breath",
    "breathes",
    "breathing",
    "stillness",
    "approval",
    "test",
    "task",
    "step",
    "tight",
    "force",
    "restrict",
]

FORBIDDEN_PHRASES = [
    "hold your breath",
    "hold the breath",
    "hold this breath",
    "hold my breath",
    "hold our breath",
    "hold breath",
    "hold the silence",
    "breathe in",
    "breathe out",
    "your breath",
    "breath to slow",
    "breath slow",
    "breath slowing",
    "slow your breath",
    "stop breathing",
    "control your breath",
    "control the breath",
    "obey my breath",
    "obey my breathing",
    "the room lowers its voice",
    "almost no effort is enough",
    "let the rule loosen now",
    "perfectly still",
    "keeps you still",
    "keeps you perfectly still",
    "system holds you",
    "holds you without effort",
    "system keeps you",
    "body still",
    "keep almost still",
    "stay where you are",
    "let the breath arrive",
    "only task",
    "quiet test",
    "rests in peace",
    "written in the air",
    "do not solve this",
    "leave the quiet",
    "quiet releases",
    "quiet lets",
    "quiet now releases",
]

FORBIDDEN_STARTS = [
    "breathe ",
    "inhale ",
    "exhale ",
]

STOPWORDS = {
    "a",
    "an",
    "and",
    "around",
    "for",
    "in",
    "into",
    "now",
    "of",
    "on",
    "the",
    "to",
    "while",
    "with",
    "you",
    "your",
}


def ensure_project_cache_env() -> dict[str, str]:
    env = os.environ.copy()
    defaults = {
        "OLLAMA_MODELS": MVP_DIR / ".ollama-models",
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
    for key, value in defaults.items():
        env.setdefault(key, str(value))
        Path(env[key]).mkdir(parents=True, exist_ok=True)
    env.pop("TRANSFORMERS_CACHE", None)
    return env


def clean_sentence(text: str) -> str:
    cleaned = " ".join(str(text).strip().strip("\"'`").split())
    cleaned = re.sub(r"^[-*•]\s+", "", cleaned).strip()
    cleaned = re.sub(r"^\d+[\.)]\s+", "", cleaned).strip()
    prefixes = ["assistant:", "sentence:", "output:"]
    lower = cleaned.lower()
    for prefix in prefixes:
        if lower.startswith(prefix):
            cleaned = cleaned[len(prefix) :].strip()
            break
    return cleaned


def usable(text: str) -> bool:
    cleaned = clean_sentence(text)
    words = cleaned.split()
    if len(words) < 3 or len(words) > 10:
        return False
    lowered = cleaned.lower()
    if any(token in lowered for token in FORBIDDEN):
        return False
    if any(phrase in lowered for phrase in FORBIDDEN_PHRASES):
        return False
    if any(lowered.startswith(start) for start in FORBIDDEN_STARTS):
        return False
    if any(char.isdigit() for char in text):
        return False
    return True


def content_tokens(text: str) -> list[str]:
    cleaned = clean_sentence(text).lower()
    tokens = ["".join(ch for ch in word if ch.isalpha()) for word in cleaned.split()]
    return [token for token in tokens if token and token not in STOPWORDS]


def too_similar(text: str, used: list[str]) -> bool:
    tokens = content_tokens(text)
    if len(tokens) < 3:
        return False
    token_set = set(tokens)
    bigrams = set(zip(tokens, tokens[1:]))
    for previous in used:
        previous_tokens = content_tokens(previous)
        if len(previous_tokens) < 3:
            continue
        previous_set = set(previous_tokens)
        overlap = len(token_set & previous_set) / max(1, min(len(token_set), len(previous_set)))
        if overlap >= 0.72:
            return True
        previous_bigrams = set(zip(previous_tokens, previous_tokens[1:]))
        if bigrams and previous_bigrams and len(bigrams & previous_bigrams) >= 2:
            return True
    return False


def build_prompt(stage: str, pressure: str, intent: str, used: list[str], count: int = 1) -> str:
    used_lines = "\n".join(f"- {line}" for line in used[-16:]) or "- none"
    stage_note = {
        "calm": "Use varied images: dimness, fabric, threshold, low signal, room, permission. Avoid starting every line with the same subject.",
        "guidance": "Use invitation, calibration, tiny adjustment, listening, soft rule, or threshold. No physical instruction.",
        "evaluation": "Imply assessment through attention, signal, pattern, permission, or quiet measurement. Do not mention breath or body.",
        "overload": "Make pressure atmospheric or procedural: loop, rule, hum, system, pattern, limit. Do not restrain the listener.",
        "ending": "Vary images: system, rule, measure, signal, screen, doorway, permission, release. Do not repeat quiet plus go/release.",
    }.get(stage, "")
    if count <= 1:
        opening = "Write exactly one short English sentence for a sleep assistant in a performance."
        output_rule = "Return only the sentence."
    else:
        opening = f"Write exactly {count} different short English sentences for a sleep assistant in a performance."
        output_rule = "Return one sentence per line. No numbering. No bullets."
    return "\n".join(
        [
            opening,
            output_rule,
            "3 to 9 words only. No labels. No quotes. No numbers.",
            "Do not mention data, baseline, score, metrics, pressure, heart, pulse, symptoms, panic, diagnosis, or medical states.",
            "Do not mention walking, dancing, standing, or movement.",
            "Do not give real breathing instructions. Avoid inhale, exhale, breathe in, hold your breath, or holding silence.",
            "Do not command the listener's body. If breath appears, use it as atmosphere, not as an exercise.",
            "Do not make the system physically restrain, hold, freeze, or keep the listener still.",
            "The sentence should feel sparse, intimate, slow, and breath-paced.",
            "It can sound caring, but should contain a faint sense of system control.",
            "Vary the subject, verb, and image. Do not make minor rewrites of the previous lines.",
            "Style references, do not copy them: The room lowers its voice. Almost no effort is enough. Let the rule loosen now.",
            "Bad examples: Breathe in and hold. I control your breath. Your heart rate is high.",
            f"stage: {stage}",
            f"pressure: {pressure}",
            f"dramatic intent: {intent}",
            f"stage-specific language: {stage_note}",
            "Avoid repeating these lines:",
            used_lines,
            "/no_think",
        ]
    )


def parse_candidate_lines(text: str) -> list[str]:
    candidates = []
    for raw in text.splitlines():
        candidate = clean_sentence(raw)
        if candidate:
            candidates.append(candidate)
    if len(candidates) <= 1:
        candidates = [clean_sentence(part) for part in re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)]
        candidates = [candidate for candidate in candidates if candidate]
    return candidates


def ollama_generate(host: str, model: str, prompt: str, timeout: float, count: int = 1) -> list[str]:
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Answer only with the final sentence. Do not include reasoning, labels, or explanations. /no_think",
            },
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "think": False,
        "options": {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 20,
            "num_predict": max(32, count * 18),
        },
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{host.rstrip('/')}/api/chat",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
            message = result.get("message", {})
            return parse_candidate_lines(message.get("content", ""))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return []


def synthesize(text: str, output: Path, args: argparse.Namespace, env: dict[str, str]) -> dict:
    command = [
        args.python,
        str(SYNTH_SCRIPT),
        "--text",
        text,
        "--output",
        str(output),
        "--engine",
        args.tts_engine,
        "--model",
        args.tts_model,
        "--voice",
        args.voice,
        "--language",
        args.language,
        "--instruct",
        args.instruct,
    ]
    started = time.perf_counter()
    completed = subprocess.run(command, check=True, text=True, capture_output=True, env=env, timeout=args.tts_timeout)
    line = completed.stdout.strip().splitlines()[-1]
    metadata = json.loads(line)
    metadata["wallSeconds"] = round(time.perf_counter() - started, 4)
    return metadata


def existing_audio_metadata(path: Path) -> dict:
    if not path.exists() or path.stat().st_size <= 44:
        return {}
    try:
        import soundfile as sf

        info = sf.info(str(path))
        return {
            "sampleRate": info.samplerate,
            "durationSeconds": round(float(info.frames / info.samplerate), 4) if info.samplerate else None,
            "cached": True,
        }
    except Exception:  # noqa: BLE001 - 只用于恢复元数据，失败时不阻断
        return {"cached": True}


def softened_audio(audio, sample_rate):
    import numpy as np

    audio = np.asarray(audio, dtype=np.float32)
    if audio.size == 0 or not sample_rate:
        return audio
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
    return np.concatenate([lead, np.clip(audio * 0.78, -1.0, 1.0), tail])


class QwenOfficialTtsBatcher:
    def __init__(self, model_id: str):
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
        self.model = Qwen3TTSModel.from_pretrained(model_id, device_map=device_map, dtype=dtype, **extra)

    def synthesize(self, text: str, output: Path, language: str, instruct: str) -> dict:
        import soundfile as sf

        started = time.perf_counter()
        wavs, sample_rate = self.model.generate_voice_design(text=text, language=language, instruct=instruct)
        audio = softened_audio(wavs[0], sample_rate)
        sf.write(str(output), audio, sample_rate)
        duration_s = float(len(audio) / sample_rate) if sample_rate else 0.0
        return {
            "engine": "qwen3_tts_official",
            "sampleRate": sample_rate,
            "durationSeconds": round(duration_s, 4),
            "synthSeconds": round(time.perf_counter() - started, 4),
        }


def create_local_tts_batcher(args: argparse.Namespace):
    if args.text_only or args.tts_engine != "qwen3_tts_official":
        return None
    if Path(sys.executable).resolve() != Path(args.python).resolve():
        return None
    try:
        return QwenOfficialTtsBatcher(args.tts_model)
    except Exception as exc:  # noqa: BLE001 - 批处理失败时自动回退到子进程方式
        print(json.dumps({"warning": "batch_tts_unavailable", "error": str(exc)}, ensure_ascii=False))
        return None


def target_count_for_stage(total_per_stage: int, stage: str) -> int:
    if stage == "overload":
        return math.ceil(total_per_stage * 1.35)
    if stage == "ending":
        return max(4, math.ceil(total_per_stage * 0.75))
    return total_per_stage


def project_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def audio_url_for(output_dir: Path, audio_path: Path) -> str:
    try:
        relative = audio_path.resolve().relative_to(MVP_DIR)
        return "/" + relative.as_posix()
    except ValueError:
        return f"/tts/{output_dir.name}/audio/{audio_path.name}"


def count_values(items: list[dict], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = str(item.get(key, "unknown"))
        counts[value] = counts.get(value, 0) + 1
    return counts


def append_process_log(manifest_path: Path, manifest: dict, mode: str) -> None:
    log_path = ROOT / "docs" / "process-log.md"
    if not log_path.exists():
        return
    cues = manifest.get("cues", [])
    meta = manifest.get("meta", {})
    entry = "\n".join(
        [
            "",
            f"## {time.strftime('%Y-%m-%d')}：自动记录：预生成语音资产",
            "",
            f"目标：{mode}",
            "",
            f"- 产物：`{project_path(manifest_path)}`",
            f"- cue 数：{len(cues)}",
            f"- 阶段统计：{count_values(cues, 'stage')}",
            f"- 文本来源统计：{count_values(cues, 'textSource')}",
            f"- LLM：{meta.get('llmModel', 'unknown')}",
            f"- thinking：{meta.get('llmThinkingControl', 'unknown')}",
            f"- TTS：{meta.get('ttsEngine', 'unknown')} / {meta.get('ttsModel', 'unknown')}",
            f"- textErrors：{len(manifest.get('textErrors', []))}",
            f"- audioErrors：{len(manifest.get('audioErrors', []))}",
            "",
            "报告意义：该条为脚本自动生成的过程摘要，用于追踪文本/TTS 资产的来源、质量筛选和错误情况。",
            "",
        ]
    )
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(entry)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="预生成文本和 TTS 音频。")
    parser.add_argument("--count-per-stage", type=int, default=12)
    parser.add_argument("--ollama-host", default=os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11435"))
    parser.add_argument("--llm-model", default=os.environ.get("QWEN_MODEL", DEFAULT_LLM_MODEL))
    parser.add_argument("--python", default=os.environ.get("TTS_PYTHON", str(MVP_DIR / ".venv-qwen-tts" / "bin" / "python")))
    parser.add_argument("--tts-engine", default=os.environ.get("TTS_ENGINE", "qwen3_tts_official"))
    parser.add_argument("--tts-model", default=os.environ.get("TTS_MODEL", DEFAULT_TTS_MODEL))
    parser.add_argument("--voice", default=os.environ.get("TTS_VOICE", "qwen3-voice-design"))
    parser.add_argument("--language", default=os.environ.get("TTS_LANGUAGE", "English"))
    parser.add_argument("--instruct", default=os.environ.get("TTS_INSTRUCT", DEFAULT_INSTRUCT))
    parser.add_argument("--output-dir", type=Path, default=PRECOMPUTED_DIR)
    parser.add_argument("--reuse-text-manifest", type=Path, help="复用已有 manifest 的文本，只重新合成音频。")
    parser.add_argument("--text-only", action="store_true", help="只生成文本 manifest，不合成音频。")
    parser.add_argument("--ollama-timeout", type=float, default=18.0)
    parser.add_argument("--batch-size", type=int, default=8, help="每次向本地 LLM 请求的候选句数量。")
    parser.add_argument("--tts-timeout", type=float, default=180.0)
    parser.add_argument("--overwrite-audio", action="store_true", help="重新生成已存在的 wav 文件。")
    parser.add_argument("--seed", type=int, default=2526)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.output_dir.is_absolute():
        args.output_dir = args.output_dir.resolve()
    else:
        args.output_dir = (ROOT / args.output_dir).resolve()
    if args.reuse_text_manifest and not args.reuse_text_manifest.is_absolute():
        args.reuse_text_manifest = (ROOT / args.reuse_text_manifest).resolve()
    random.seed(args.seed)
    env = ensure_project_cache_env()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    audio_dir = args.output_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    local_tts = create_local_tts_batcher(args)

    cues = []
    text_errors = []
    audio_errors = []

    if args.reuse_text_manifest:
        source = json.loads(args.reuse_text_manifest.read_text(encoding="utf-8"))
        source_cues = [cue for cue in source.get("cues", []) if cue.get("text") and cue.get("stage")]
        for index, cue in enumerate(source_cues, start=1):
            stage = cue["stage"]
            text = cue["text"]
            file_stem = cue.get("id") or f"{stage}-{index:02d}"
            audio_path = audio_dir / f"{file_stem}.wav"
            audio_url = audio_url_for(args.output_dir, audio_path)
            tts_metadata = {}
            if not args.text_only:
                try:
                    print(
                        json.dumps(
                            {
                                "event": "synthesize_audio",
                                "index": index,
                                "total": len(source_cues),
                                "stage": stage,
                                "id": file_stem,
                                "text": text,
                            },
                            ensure_ascii=False,
                        ),
                        file=sys.stderr,
                        flush=True,
                    )
                    if audio_path.exists() and not args.overwrite_audio:
                        tts_metadata = existing_audio_metadata(audio_path)
                        print(
                            json.dumps(
                                {
                                    "event": "audio_cached",
                                    "index": index,
                                    "total": len(source_cues),
                                    "id": file_stem,
                                    "path": project_path(audio_path),
                                },
                                ensure_ascii=False,
                            ),
                            file=sys.stderr,
                            flush=True,
                        )
                    elif local_tts:
                        tts_metadata = local_tts.synthesize(text, audio_path, args.language, args.instruct)
                    else:
                        tts_metadata = synthesize(text, audio_path, args, env)
                    if not tts_metadata.get("cached"):
                        print(
                            json.dumps(
                                {
                                    "event": "audio_done",
                                    "index": index,
                                    "total": len(source_cues),
                                    "id": file_stem,
                                    "durationSeconds": tts_metadata.get("durationSeconds"),
                                    "sampleRate": tts_metadata.get("sampleRate"),
                                },
                                ensure_ascii=False,
                            ),
                            file=sys.stderr,
                            flush=True,
                        )
                except Exception as exc:  # noqa: BLE001
                    audio_errors.append({"stage": stage, "text": text, "error": str(exc)})
                    audio_url = None
            cues.append(
                {
                    **cue,
                    "audioUrl": audio_url,
                    "audioPath": str(audio_path.relative_to(ROOT)) if audio_url else None,
                    "ttsEngine": args.tts_engine,
                    "ttsModel": args.tts_model,
                    "voice": args.voice,
                    "language": args.language,
                    "durationSeconds": tts_metadata.get("durationSeconds"),
                    "sampleRate": tts_metadata.get("sampleRate"),
                }
            )
        manifest = {
            "meta": {
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "purpose": "从已有文本 manifest 批量生成 Qwen3-TTS 音频。",
                "llmModel": source.get("meta", {}).get("llmModel", args.llm_model),
                "llmThinking": "disabled",
                "llmThinkingControl": "Ollama /api/chat think=false + Qwen /no_think",
                "promptProfile": source.get("meta", {}).get("promptProfile", "safe_sleep_performance_v2"),
                "ttsEngine": args.tts_engine,
                "ttsModel": args.tts_model,
                "voice": args.voice,
                "language": args.language,
                "cachePolicy": "所有模型缓存和音频资产都保存在项目目录内。",
                "modelCache": str(MODEL_CACHE.relative_to(ROOT)),
                "ollamaModels": str((MVP_DIR / ".ollama-models").relative_to(ROOT)),
            },
            "cues": cues,
            "textErrors": source.get("textErrors", []),
            "audioErrors": audio_errors,
        }
        manifest_path = args.output_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        append_process_log(manifest_path, manifest, "从已有文本 manifest 批量生成或更新音频资产。")
        print(json.dumps({"manifest": str(manifest_path), "cues": len(cues), "audioErrors": len(audio_errors)}, ensure_ascii=False))
        return

    for stage, config in STAGES.items():
        used: list[str] = []
        selected: list[dict[str, str]] = []
        target = target_count_for_stage(args.count_per_stage, stage)
        attempts = 0
        max_attempts = max(8, math.ceil(target / max(1, args.batch_size)) * 6)
        fallback_pool = list(config["fallback"])
        random.shuffle(fallback_pool)

        while len(used) < target and attempts < max_attempts:
            attempts += 1
            request_count = min(args.batch_size, max(1, (target - len(used)) * 2))
            prompt = build_prompt(stage, config["pressure"], config["intent"], used, request_count)
            candidates = ollama_generate(
                args.ollama_host,
                args.llm_model,
                prompt,
                args.ollama_timeout,
                request_count,
            )
            if not candidates:
                text_errors.append({"stage": stage, "candidate": "", "reason": "no_candidates"})
                continue
            for raw_candidate in candidates:
                if len(used) >= target:
                    break
                candidate = clean_sentence(raw_candidate)
                text_source = "qwen_generated"
                if not usable(candidate):
                    text_errors.append({"stage": stage, "candidate": candidate, "reason": "unusable"})
                    continue
                if too_similar(candidate, used):
                    text_errors.append({"stage": stage, "candidate": candidate, "reason": "too_similar"})
                    continue
                if candidate in used:
                    continue
                used.append(candidate)
                selected.append({"text": candidate, "textSource": text_source})
                print(
                    json.dumps(
                        {
                            "event": "accepted_text",
                            "stage": stage,
                            "source": text_source,
                            "index": len(selected),
                            "target": target,
                            "text": candidate,
                        },
                        ensure_ascii=False,
                    ),
                    file=sys.stderr,
                    flush=True,
                )

        while len(selected) < target and fallback_pool:
            candidate = fallback_pool.pop()
            if not usable(candidate) or candidate in used:
                continue
            used.append(candidate)
            selected.append({"text": candidate, "textSource": "curated_fallback"})
            print(
                json.dumps(
                    {
                        "event": "accepted_text",
                        "stage": stage,
                        "source": "curated_fallback",
                        "index": len(selected),
                        "target": target,
                        "text": candidate,
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
                flush=True,
            )

        for index, item in enumerate(selected, start=1):
            text = item["text"]
            file_stem = f"{stage}-{index:02d}"
            audio_path = audio_dir / f"{file_stem}.wav"
            audio_url = None if args.text_only else audio_url_for(args.output_dir, audio_path)
            tts_metadata = {}
            if not args.text_only:
                try:
                    if local_tts:
                        tts_metadata = local_tts.synthesize(text, audio_path, args.language, args.instruct)
                    else:
                        tts_metadata = synthesize(text, audio_path, args, env)
                except Exception as exc:  # noqa: BLE001 - 保存失败原因给报告排查
                    audio_errors.append({"stage": stage, "text": text, "error": str(exc)})
                    audio_url = None

            cues.append(
                {
                    "id": file_stem,
                    "stage": stage,
                    "pressure": config["pressure"],
                    "text": text,
                    "textSource": item["textSource"],
                    "audioUrl": audio_url,
                    "audioPath": str(audio_path.relative_to(ROOT)) if audio_url else None,
                    "textModel": args.llm_model,
                    "ttsEngine": args.tts_engine,
                    "ttsModel": args.tts_model,
                    "voice": args.voice,
                    "language": args.language,
                    "durationSeconds": tts_metadata.get("durationSeconds"),
                    "sampleRate": tts_metadata.get("sampleRate"),
                }
            )

    manifest = {
        "meta": {
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "purpose": "报告、示例视频和现场 fallback 使用的预生成睡眠助手语音。",
            "llmModel": args.llm_model,
            "llmThinking": "disabled",
            "llmThinkingControl": "Ollama /api/chat think=false + Qwen /no_think",
            "promptProfile": "safe_sleep_performance_v2",
            "ttsEngine": args.tts_engine,
            "ttsModel": args.tts_model,
            "voice": args.voice,
            "language": args.language,
            "cachePolicy": "所有模型缓存和音频资产都保存在项目目录内。",
            "modelCache": str(MODEL_CACHE.relative_to(ROOT)),
            "ollamaModels": str((MVP_DIR / ".ollama-models").relative_to(ROOT)),
        },
        "cues": cues,
        "textErrors": text_errors,
        "audioErrors": audio_errors,
    }
    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    append_process_log(manifest_path, manifest, "生成睡眠助手短句，并按统一 schema 输出预生成资产 manifest。")
    print(json.dumps({"manifest": str(manifest_path), "cues": len(cues), "audioErrors": len(audio_errors)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
