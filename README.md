# Guided Baseline / 睡眠基线

本仓库是“睡眠基线”本地 MVP：用 replay 生理 proxy 驱动视觉、音乐、语音和日志导出，用于 final report、portfolio 和演出调试。

## 快速运行

```bash
cd /Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG
./mvp/start-local.sh
```

打开：

```text
http://127.0.0.1:4173
```

只启动 Node 服务：

```bash
npm start
# 或者不依赖 npm：
node mvp/server/index.js
```

## 常用命令

生成合成 replay：

```bash
python3 scripts/data/preprocess_replay.py --synthetic --output mvp/data/replay/demo_replay.json
```

校验 replay：

```bash
npm run validate:replay
```

预生成语音：

```bash
mvp/.venv-qwen-tts/bin/python scripts/voice/pregenerate_voice_assets.py --count-per-stage 12
```

安装或更新本地模型：

```bash
QWEN_MODEL=qwen3.5:27b ./scripts/setup/setup_qwen_models.sh
```

基础 smoke test：

```bash
./scripts/smoke.sh
```

## 目录说明

- `mvp/`: 可运行应用。浏览器入口在 `mvp/public/`，前端模块在 `mvp/src/`，服务端模块在 `mvp/server/`。
- `scripts/`: 数据预处理、语音预生成、模型设置脚本。
- `data/`: 原始数据与处理后数据说明。
- `docs/`: 项目计划、实现指南、过程日志和报告证据索引。
- `artifacts/test-runs/`: 测试报告、截图和演示证据。
- `mvp/shared/`: 阶段配置与 replay schema 说明。
- `requirements-tts.txt`: Qwen3-TTS 本地语音依赖说明。

## 本地运行产物

这些目录是可再生成的运行产物，默认不进入版本管理：

- `.model-cache/`
- `.ollama-models/`
- `runtime/`
- `mvp/.model-cache/`
- `mvp/.ollama-models/`
- `mvp/.venv-qwen-tts/`
- `mvp/tts/generated/`
- `mvp/tts/output/`
- `mvp/tts/previews/`
- `mvp/tts/models/`

过程记录见 `docs/process-log.md`，最终报告证据索引见 `docs/evidence-index.md`。
