# 睡眠基线 MVP

这是无硬件版本的本地最小可行产物：同一个 UI 内完成演出、标志、音乐、语音和导出测试。

```bash
conda activate guided-baseline-mvp
cd /Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG
./mvp/start-local.sh
```

打开：

```text
http://127.0.0.1:4173
```

## 当前模块

- 阶段：安静进入、引导放松、评估、过载、结束。
- 数据源：默认加载 `mvp/data/replay/demo_replay.json`；失败时使用 mock timeline。
- 标志：根据压力实时改变跳动、亮度、抖动、漂移和边缘。
- 音乐：CC0 氛围素材分轨，按压力、呼吸相位、心率和 HRV proxy 实时映射。
- 短句：默认使用项目本地 Ollama + `qwen3.5:27b`，失败时自动 fallback。
- TTS：默认使用项目本地 Qwen3-TTS VoiceDesign；Kokoro 保留为备用。
- 保存：浏览器导出 JSON，包含 replay 来源、生理 proxy、视觉状态、音频参数和语音事件；服务端同时保存 TTS 音频和 `tts/generated/manifest.jsonl`。

## Replay 数据

生成合成数据：

```bash
python3 scripts/data/preprocess_replay.py --synthetic --output mvp/data/replay/demo_replay.json
```

校验 replay：

```bash
python3 scripts/data/preprocess_replay.py --validate mvp/data/replay/demo_replay.json
```

测试开源 CSV 片段：

```bash
python3 scripts/data/preprocess_replay.py --physionet-demo data/raw/example.csv --output mvp/data/replay/open_data_replay.json
```

开源数据只用于算法测试和调参，不能在最终文档中伪装成表演者本人数据。

## 实时与延迟

必须实时响应：

- 标志跳动频率、抖动、亮度；
- 音乐混合、滤波和压力测试；
- 状态日志记录。

允许延迟响应：

- Qwen 生成短句；
- Kokoro TTS 合成；
- 导出和后期整理。

## 文本与语音策略

当前 MVP 默认使用本地 Qwen3.5 + Qwen3-TTS 进行现场生成，并保留 fallback phrase bank、浏览器语音和已生成音频文件作为备案。若正式演出需要更高质量的实时语音，可以接入 API，或在更高级别 GPU 上运行更大的文本模型 / TTS 模型。

报告示例、演出视频和 portfolio 展示可以使用预生成或缓存文本/语音：先用更强模型生成和筛选睡眠助手短句，再用高质量 TTS 生成音频。这样一方面能展示系统具备实时生成和快速 fallback 的能力，另一方面能保证提交材料中的语音质量稳定。

## 本地模型与缓存

所有模型缓存必须保存在项目目录内：

- Ollama：`mvp/.ollama-models`
- Hugging Face / Transformers / MLX / pip cache：`mvp/.model-cache`
- Qwen3-TTS 项目虚拟环境：`mvp/.venv-qwen-tts`
- 预生成语音：`mvp/tts/precomputed`

安装或更新模型：

```bash
cd /Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG
QWEN_MODEL=qwen3.5:27b ./scripts/setup/setup_qwen_models.sh
```

本机为 24GB 统一内存。`qwen3.5:35b` 的 Ollama 包约 24GB，给系统、浏览器、音频和 TTS 留不出余量；因此默认选择 `qwen3.5:27b` 作为报告预生成和本地高质量文本模型。

Qwen 使用项目本地 Ollama 模型目录：

```bash
OLLAMA_HOST=127.0.0.1:11435 \
OLLAMA_MODELS=/Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG/mvp/.ollama-models \
conda run -n guided-baseline-mvp ollama pull qwen3.5:27b
```

TTS 默认使用项目内 venv：

```bash
/Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG/mvp/.venv-qwen-tts/bin/python
```

可通过环境变量覆盖：

```bash
TTS_PYTHON=/path/to/python TTS_ENGINE=qwen3_tts_official ./mvp/start-local.sh
```

预生成大量文本和对应音频：

```bash
TTS_PYTHON=/Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG/mvp/.venv-qwen-tts/bin/python \
mvp/.venv-qwen-tts/bin/python scripts/voice/pregenerate_voice_assets.py --count-per-stage 12
```

文本生成、prompt 迭代、fallback 问题和质量筛选过程记录在项目根目录 `docs/process-log.md`。当前可进入 TTS 的推荐文本库是 `mvp/tts/precomputed/qwen35_quality_100/manifest_final_100.json`，对应质量报告是 `mvp/tts/precomputed/qwen35_quality_100/QUALITY_REPORT.md`。

当前默认预生成语音库已经生成：

- `mvp/tts/precomputed/manifest.json`
- `mvp/tts/precomputed/audio/*.wav`

中文测试阶段语音库已经生成，独立保存，不覆盖英文默认库：

- `mvp/tts/precomputed_zh/manifest_text_zh.json`
- `mvp/tts/precomputed_zh/manifest.json`
- `mvp/tts/precomputed_zh/audio/*.wav`

启动中文预生成语音测试：

```bash
cd /Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG
PORT=4174 \
VOICE_MODE=precomputed \
TTS_PRECOMPUTED_DIR=/Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG/mvp/tts/precomputed_zh \
TTS_LANGUAGE=Chinese \
./mvp/start-local.sh
```

报告证据索引见项目根目录 `docs/evidence-index.md`。

## 输出位置

- TTS 音频：`mvp/tts/generated/*.wav`
- 预生成语音：`mvp/tts/precomputed/manifest.json` 和 `mvp/tts/precomputed/audio/*.wav`
- 语音 manifest：`mvp/tts/generated/manifest.jsonl`
- 前端导出：浏览器下载的 `guided-baseline-mvp-log-*.json`

页面或标签页隐藏时会暂停/关闭音频；打开页面本身不会自动播放音乐。
