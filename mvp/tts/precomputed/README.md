# 预生成语音资产

这里保存报告、示例视频和现场 fallback 使用的预生成文本与音频。

默认生成流程：

```bash
cd /Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG
QWEN_MODEL=qwen3.5:27b ./scripts/setup/setup_qwen_models.sh
TTS_PYTHON=/Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG/mvp/.venv-qwen-tts/bin/python \
mvp/.venv-qwen-tts/bin/python scripts/voice/pregenerate_voice_assets.py --count-per-stage 12
```

输出：

- `manifest.json`：文本、阶段、pressure、模型来源、音频路径。
- `audio/*.wav`：Qwen3-TTS 生成的语音。

当前推荐文本库：

- `qwen35_quality_100/manifest_final_100.json`：99 条严格通过文本，均为 `qwen_generated`。
- `qwen35_quality_100/QUALITY_REPORT.md`：100 条生成、筛选、复核、补生成的质量报告。
- `qwen35_quality_100/quality_flags.json`：每条文本的 pass / review / reject 标记。

## 中文测试语音库

中文演示和测试阶段使用独立目录，不覆盖英文默认库：

- `../precomputed_zh/manifest_text_zh.json`：99 条中文文本，保留英文 `originalText`，文本来源为 `manual_curated_translation`。
- `../precomputed_zh/manifest.json`：99 条中文文本与 Qwen3-TTS wav 的统一 manifest。
- `../precomputed_zh/audio/*.wav`：中文预生成音频。

生成命令：

```bash
cd /Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG
mvp/.venv-qwen-tts/bin/python scripts/voice/pregenerate_voice_assets.py \
  --reuse-text-manifest mvp/tts/precomputed_zh/manifest_text_zh.json \
  --output-dir mvp/tts/precomputed_zh \
  --language Chinese \
  --instruct '平静、亲密的成年女性声音，音量较低，语速慢，像贴近耳边的系统提示，柔软但略带机械感，吐字清楚，不要欢快。' \
  --tts-timeout 300
```

本地服务测试命令：

```bash
cd /Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG
PORT=4174 \
VOICE_MODE=precomputed \
TTS_PRECOMPUTED_DIR=/Users/if_man/Documents/GitHub/PerformanceData_YifanZHANG/mvp/tts/precomputed_zh \
TTS_LANGUAGE=Chinese \
npm start
```

测试报告：`artifacts/test-runs/chinese_precomputed_voice_test/测试报告.json`。

过程记录：

- 项目总过程日志：`docs/process-log.md`
- 后续每次修改 prompt、过滤规则、模型参数、TTS 或质量筛选结果，都需要同步更新 `docs/process-log.md` 或对应目录下的质量报告。

所有模型下载缓存必须留在项目目录内：`mvp/.model-cache` 和 `mvp/.ollama-models`。
