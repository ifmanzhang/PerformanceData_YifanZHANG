# Local TTS Benchmark

测试日期：2026-05-18

测试机器：M4 MacBook Air, macOS 26.2, arm64

测试环境：`guided-baseline-tts`

测试文本：

- `You do not need to do anything.`
- `Let the breath arrive.`
- `Stay where you are.`
- `You may stop trying.`

## Tested Candidates

| Candidate | Voice | Role | Source |
| --- | --- | --- | --- |
| Kokoro ONNX | `af_nicole`, `af_heart`, `af_bella` | Main candidate: good quality, local, fast enough for delayed speech cues | [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) |
| Piper | `en_US-lessac-high` | Fast fallback / low-latency option | [piper-tts](https://pypi.org/project/piper-tts/), [Piper voices](https://rhasspy.github.io/piper-samples/) |
| macOS `say` | `Samantha` | Zero-install fallback | macOS built-in |

## Second Run Results

This is the warmed-cache run. Times are measured from text input to audio file written.

| Candidate | Load time | First line incl. load | Avg synth | Median synth | Avg RTF | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Piper `en_US-lessac-high` | 0.4841s | 0.9363s | 0.3549s | 0.3410s | 0.2526 | Fastest. Quality is usable, less intimate than Kokoro. |
| Kokoro `af_nicole` | 1.7389s | 2.5967s | 1.7389s | 2.5967s | 0.6696 | Current calmer default. Softer timbre with slow pacing and softened wav edges. |
| Kokoro `af_heart` | 0.3089s | 0.9161s | 0.5300s | 0.5150s | 0.3385 | Brighter previous default. |
| macOS `say` Samantha | 0s | 0.5857s | 0.5808s | 0.5814s | 0.4820 | Reliable but sounds system-like. |
| Kokoro `af_bella` | 0.3061s | 1.4416s | 0.6833s | 0.5532s | 0.4477 | More expressive, first line slower. |

RTF means real-time factor. Lower is faster. `0.34` means roughly 34% of the audio duration is needed to synthesize.

## First Run Results

| Candidate | Load time | First line incl. load | Avg synth | Median synth | Avg RTF |
| --- | ---: | ---: | ---: | ---: | ---: |
| Piper `en_US-lessac-high` | 0.4793s | 1.1335s | 0.4166s | 0.3483s | 0.2713 |
| Kokoro `af_heart` | 0.3087s | 0.9391s | 0.5315s | 0.5084s | 0.3387 |
| macOS `say` Samantha | 0s | 0.5760s | 0.5771s | 0.5765s | 0.4796 |
| Kokoro `af_bella` | 0.3054s | 1.4797s | 0.6986s | 0.5609s | 0.4570 |

## Recommendation

早期 MVP 使用 Kokoro ONNX `af_nicole` 作为主 TTS，因为它已经本地跑通、延迟可控，并且适合排练阶段。当前目标升级为 Qwen3-TTS VoiceDesign：报告和示例视频优先使用 Qwen3-TTS 预生成高质量语音，Kokoro 保留为现场快速备用。

Keep Piper `en_US-lessac-high` as a fallback if the machine is under load or if we need sub-500ms response. Keep macOS `say` only as emergency fallback.

## 报告与演出取舍

当前报告与预生成默认使用 Qwen3-TTS VoiceDesign。若需要更强实时能力，可以接入 API，或在更高级别 GPU 上运行更大的 Qwen3-TTS / 文本模型。本机版本会把所有模型缓存固定在项目目录内：`mvp/.model-cache`、`mvp/.ollama-models`、`mvp/.venv-qwen-tts`。

报告测试、示例视频和 portfolio 可以使用预生成或缓存语音：先用更强的文本模型和 TTS 模型生成高质量短句与音频，再在 replay 演出中播放。这样既保留现场实时生成和 fallback 的技术证据，也保证展示材料中的语音质量稳定。

## Files

- Benchmark script: `mvp/tts/benchmark_tts.py`
- Raw result JSON: `mvp/tts/benchmark_results_first_run.json`, `mvp/tts/benchmark_results_second_run.json`
- Generated samples: `mvp/tts/output/`
- Local model files: `mvp/tts/models/` ignored by `.gitignore`

## Re-run

```bash
conda activate guided-baseline-tts
cd /Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG
python mvp/tts/benchmark_tts.py
```
