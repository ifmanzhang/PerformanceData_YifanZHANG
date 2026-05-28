# 项目过程记录

本文档记录项目推进中的关键技术选择、失败点、修正策略和可引用产物，用于支持最终报告、portfolio 和 reflection。所有叙述文档使用中文；代码字段名、模型名、文件名保留英文。

## 记录规则

从 2026-05-26 起，之后每次发生以下情况，都需要同步记录到本文档或本文档链接的子报告中：

- 数据策略、模型策略、表演结构发生变化。
- 生成、预处理、TTS、replay、声音或视觉链路出现失败、卡顿、质量问题。
- prompt、过滤规则、模型参数、fallback 策略被修改。
- 产出新的测试结果、manifest、质量报告、截图、日志或视频。
- 出现可用于 reflection 的判断，例如为什么不用实时传感器、为什么预生成、为什么删除某类句子。

推荐记录格式：

```text
日期 / 目标 / 方法 / 问题 / 修正 / 产物 / 对最终报告的意义
```

## 2026-05-26：无真实数据阶段的数据路线

目标：在学校呼吸传感器和心率/ECG 设备连接不稳定、真实数据暂时不可用的情况下继续推进项目。

方法：

- 先使用合成数据搭建完整 replay 架构。
- 再接入 PhysioNet 等开源生理数据，验证 ECG + respiration 预处理流程。
- 最终学校或本人数据到手后，只替换 replay 输入，不改视觉、声音、语音和日志结构。

决策：

- 合成数据用于结构开发、表演节奏和 mapping 调试。
- 开源数据只用于算法测试和调参，不伪装成表演者本人数据。
- 学校/本人离线采集数据作为最终表演主要材料。

产物：

- `scripts/data/preprocess_replay.py`
- `mvp/data/replay/demo_replay.json`
- `mvp/data/replay/README.md`
- `artifacts/test-runs/synthetic_replay_full_test/测试报告.json`
- `docs/project-plan.md` 中“无真实数据阶段的数据策略”

报告意义：这说明“离线 replay”不是临时妥协，而是可靠性、伦理边界和表演概念共同决定的技术路线。

## 2026-05-26：合成 replay 与全链路 MVP

目标：在没有真实传感器数据时，用统一 replay schema 跑通完整表演链路。

方法：

- 生成五分钟 `demo_replay.json`，包含 `breathPhase`、`breathRate`、`breathingStability`、`heartRateBpm`、`rrInterval`、`hrvProxy`、`cardiacArousal`、`baselineDeviation`、`pressure`。
- MVP 增加 replay mode，mock timeline 作为 fallback。
- 日志导出包含 replay source、生理 proxy、视觉状态、音频参数和语音事件。

产物：

- `mvp/src/main.js`
- `mvp/server/index.js`
- `mvp/data/replay/demo_replay.json`
- `artifacts/test-runs/synthetic_replay_full_test/测试报告.json`

报告意义：证明系统不是静态可视化，而是具备“数据输入 -> 生理 proxy -> 视觉/声音/语音 -> 日志证据”的闭环。

## 2026-05-26：本地模型与缓存策略

目标：将文本模型和 TTS 模型升级为 Qwen 开源路线，同时保证所有缓存留在项目目录内。

方法：

- 文本模型默认使用本地 Ollama `qwen3.5:27b`。
- TTS 默认使用 `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`。
- 项目内统一缓存：
  - Ollama：`mvp/.ollama-models`
  - Hugging Face / Transformers / MLX / pip：`mvp/.model-cache`
  - Qwen3-TTS venv：`mvp/.venv-qwen-tts`
  - 预生成资产：`mvp/tts/precomputed`

关键判断：

- 本机为 24GB 统一内存，`qwen3.5:35b` 对系统、浏览器、音频和 TTS 余量过低，因此不作为默认。
- `qwen3.5:27b` 可作为本机高质量文本预生成模型，但实时性能仍慢。
- 实时演出若要高质量即时生成，可以接 API 或使用更强 GPU；报告和视频使用预生成文本/音频，以保证质量稳定。

产物：

- `mvp/model-env.sh`
- `scripts/setup/setup_qwen_models.sh`
- `mvp/start-local.sh`
- `mvp/server/index.js`
- `mvp/README.md`

报告意义：这支持“实时系统有 fallback，提交材料用高质量预生成”的双层策略，也能解释为什么报告版和现场版可以采用不同延迟预算。

## 2026-05-26：Qwen3-TTS 路线测试

目标：将 TTS 从早期轻量方案升级到 Qwen3-TTS VoiceDesign。

过程：

- 尝试 MLX 路线时发现当前 `mlx-audio` 未能直接支持 `qwen3_tts` 模型类型。
- 改用官方 `qwen-tts` Python 包加载 `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`。
- 单条 smoke test 成功生成 wav，采样率 24000Hz。

问题：

- 首次加载和生成很慢，单条测试约 98 秒。
- 本机适合预生成高质量语音，不适合把 Qwen3-TTS 当作现场低延迟 TTS 唯一方案。

产物：

- `mvp/tts/synthesize_once.py`
- `mvp/tts/precomputed/test-qwen3-tts.wav`
- `mvp/tts/TTS_BENCHMARK.md`

报告意义：说明模型升级不是盲目追求“大模型”，而是经过本机性能和表演稳定性权衡后，确定“预生成高质量语音 + fallback”的策略。

## 2026-05-26：第一次文本预生成失败与 fallback 问题

目标：用 `qwen3.5:27b` 预生成睡眠助手短句。

问题：

- 初始批量脚本输出的 30 条文本虽然规则上合格，但大量来自 fallback 文本池。
- manifest 中 `textErrors: 256`，说明 Qwen 输出多数被过滤。
- 因此它只能证明脚本可运行，不能证明 Qwen 文本生成质量。

判断：

- 这批文本可用于 MVP 临时测试。
- 不适合作为最终语音库。
- 需要在 manifest 中区分 `textSource: qwen_generated / curated_fallback`。

产物：

- `mvp/tts/precomputed/text_seed/manifest.json`

报告意义：这是一个有价值的反例：生成式系统不能只看“有没有输出”，还需要记录输出来源和质量筛选过程。

## 2026-05-26：关闭 Qwen3.5 thinking mode

目标：关闭 Qwen3.5 的思考模式，提升短句生成速度和可控性。

官方依据：

- Qwen 官方支持 `enable_thinking=False` 和 `/no_think`。
- Ollama 官方支持请求级 `think:false`，交互模式可用 `/set nothink`。
- Qwen 文档：https://qwen.readthedocs.io/en/v3.0/getting_started/quickstart.html
- Qwen Transformers 推理文档：https://qwen.readthedocs.io/en/stable/inference/transformers.html
- Ollama thinking 文档：https://docs.ollama.com/capabilities/thinking

测试结果：

- 旧路径 `/api/generate + think:false`：90 秒超时，无结果。
- 新路径 `/api/chat + think:false + /no_think`：约 41 秒返回，`thinking_len=0`，无 `<think>`。

修正：

- `scripts/voice/pregenerate_voice_assets.py` 改为 `/api/chat`。
- `mvp/server/index.js` 的实时 Qwen 调用也改为 `/api/chat`。
- manifest 元数据记录 `llmThinking: disabled` 与 `llmThinkingControl`。

产物：

- `mvp/tts/precomputed/qwen35_nothink_test/manifest.json`
- `scripts/voice/pregenerate_voice_assets.py`
- `mvp/server/index.js`

报告意义：说明 prompt 和 API 调用方式本身就是创作系统的一部分；关闭 thinking 后，系统更适合生成简短、可表演的语音 cue。

## 2026-05-26：提示词质量迭代

目标：让文本从“睡眠训练指令”转向“温柔、系统化、带轻微控制感但不直接指导身体”的表演语言。

第一轮问题：

- 出现示例复制：`The room lowers its voice.`
- 出现身体约束感：`The system keeps you perfectly still.`、`The system holds you without effort.`

第二轮问题：

- 9 条均来自 Qwen，但 ending 阶段重复较多。
- evaluation 出现直接呼吸表达：`The system allows your breath to slow.`

第三轮结果：

- 9 条均为 `qwen_generated`。
- 无 fallback。
- 无 `<think>`。
- 无真实呼吸指令、身体约束句、示例复制。
- 唯一错误是模型试图复制示例句，被过滤器拦截。

第三轮代表文本：

```text
The room grants you permission to dim.
Let the quiet settle around you now.
The system watches you rest now.
The system hums a quiet, perfect rule.
The screen fades to let you go.
The rule loosens to let you leave.
```

产物：

- `mvp/tts/precomputed/qwen35_quality_round_1/manifest.json`
- `mvp/tts/precomputed/qwen35_quality_round_2/manifest.json`
- `mvp/tts/precomputed/qwen35_quality_round_3/manifest.json`

报告意义：这可以作为 prompt engineering 与伦理边界共同作用的过程证据：不是让模型“更像助眠 app”，而是让它成为一个可被批判的、温柔但控制性的系统声音。

## 2026-05-26：约 100 条文本生成与质量筛选

目标：生成约 100 条可用于 TTS 的高质量短句。

第一阶段问题：

- 单句逐条生成太慢。
- calm 阶段出现模板化倾向，如反复围绕 `room grants permission` 变体生成。

修正：

- 增加批量候选生成模式：一次向 Qwen 请求多条候选，再本地筛选。
- 增加相似度过滤，拒绝过近的同义改写。
- 修改 prompt，要求变化 subject、verb、image。

初始 100 条质量检查：

- 总数：100
- Qwen 生成：92
- fallback：8
- 严格通过：81
- 建议人工复核：10
- 建议删除/重生成：9

主要问题类型：

- 旧 fallback 仍含身体/呼吸风险：`Let the breath arrive.`、`Keep almost still.`
- 个别句子过度评估：`quiet test`、`approval`
- 个别句子陈词或联想不佳：`rests in peace`、`written in the air`
- 个别 overload 句子控制感过强：`Do not solve this.`

修正：

- 删除有风险 fallback。
- 增加过滤词：`breath`、`breathes`、`breathing`、`stillness`、`approval`、`test`、`task`、`step`。
- 增加禁句：`rests in peace`、`written in the air`、`only task`、`quiet test` 等。

补生成：

- 额外生成 26 条。
- 26 条均为 `qwen_generated`。
- 合并后最终严格通过 99 条。

最终结果：

- `manifest_final_100.json`：99 条严格通过。
- 文本来源：99 条均为 `qwen_generated`。
- fallback：0。
- `<think>`：0。
- 真实呼吸/身体指令：0。
- 禁词/禁句：0。
- 重复文本：0。

阶段分布：

| 阶段 | 数量 |
| --- | ---: |
| calm | 21 |
| guidance | 15 |
| evaluation | 20 |
| overload | 28 |
| ending | 15 |

产物：

- `mvp/tts/precomputed/qwen35_quality_100/manifest.json`
- `mvp/tts/precomputed/qwen35_quality_100/manifest_strict_pass.json`
- `mvp/tts/precomputed/qwen35_quality_100/quality_flags.json`
- `mvp/tts/precomputed/qwen35_quality_100/QUALITY_REPORT.md`
- `mvp/tts/precomputed/qwen35_quality_100/manifest_final_100.json`
- `mvp/tts/precomputed/qwen35_quality_topup_25/manifest.json`

报告意义：这批记录能清楚证明文本库不是一次性生成后直接使用，而是经过模型调用方式、prompt、负面过滤、相似度过滤、人工语义判断和补生成共同形成的。

## 当前可引用结论

- 离线 replay 是为了可靠性和概念一致性，不是单纯绕开硬件问题。
- 生理指标是艺术 proxy，不做医学诊断。
- Qwen3.5 本机可用于高质量文本预生成，但实时性能有限。
- Qwen3-TTS 本机可生成高质量语音，但更适合预生成，不适合无 fallback 的低延迟现场唯一方案。
- 高质量文本库必须保留来源、过滤、复核和删除记录，不能只展示最终漂亮结果。
- 当前最适合进入 TTS 阶段的文本库是 `mvp/tts/precomputed/qwen35_quality_100/manifest_final_100.json`。

## 2026-05-26：自动记录：预生成语音资产

目标：从已有文本 manifest 批量生成或更新音频资产。

- 产物：`mvp/tts/precomputed/manifest.json`
- cue 数：99
- 阶段统计：{'calm': 21, 'guidance': 15, 'evaluation': 20, 'overload': 28, 'ending': 15}
- 文本来源统计：{'qwen_generated': 99}
- LLM：qwen3.5:27b
- thinking：Ollama /api/chat think=false + Qwen /no_think
- TTS：qwen3_tts_official / Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
- textErrors：0
- audioErrors：0

报告意义：该条为脚本自动生成的过程摘要，用于追踪文本/TTS 资产的来源、质量筛选和错误情况。

## 2026-05-26：开源 BIDMC 数据预处理测试

目标：在学校/本人数据尚未采集前，用真实开源 ECG + respiration CSV 验证预处理流程能否面对真实噪声和真实采样格式。

方法：

- 下载 PhysioNet BIDMC PPG and Respiration Dataset v1.0.0 的 `bidmc_01_Signals.csv`。
- 使用 `scripts/data/preprocess_replay.py --physionet-demo` 截取前 120 秒。
- 输出统一 replay JSON，并用 `--validate` 校验 schema。

结果：

- 输入：`data/raw/physionet_bidmc/bidmc_01_Signals.csv`
- 输出：`mvp/data/replay/bidmc_01_open_data_replay.json`
- 测试报告：`artifacts/test-runs/open_data_preprocess_bidmc_01/测试报告.json`
- frame 数：601
- rPeakCount：730
- respPeakCount：158
- pressure 范围：0.1637 到 0.5239
- 校验：通过

限制：这是开源数据小样本，只证明预处理流程能读取真实格式并生成艺术 proxy；不能伪装成表演者本人数据，也不是医学分析。

报告意义：这补足了“合成 replay 之外的真实噪声测试”证据，说明系统结构未来可以替换成学校/本人离线采集数据。

## 2026-05-26：合成 replay + 预生成语音端到端测试

目标：确认在没有真实学校数据时，MVP 能用合成 replay 和预生成 Qwen3-TTS 语音跑通演出关键接口。

方法：

- 启动 `mvp/server/index.js`，`VOICE_MODE=precomputed`。
- 读取 `mvp/data/replay/demo_replay.json`。
- 分别对 calm、guidance、evaluation、overload、ending 五个阶段调用 `/api/voice-cue`。
- 验证返回的 `audioUrl` 可作为 `audio/wav` 下载。

结果：

- 测试报告：`artifacts/test-runs/synthetic_replay_precomputed_voice_e2e/测试报告.json`
- replay frame 数：1501
- replay 时长：300 秒
- pressure 范围：0.0551 到 0.9602
- 五个阶段 voice cue 均返回 `source: precomputed`
- 音频文件均可访问，未触发实时 Qwen3.5 / Qwen3-TTS 生成

报告意义：这证明当前无真实数据阶段已经具备演示级闭环：数据 replay、服务端语音选择、预生成 TTS 音频和静态资源服务可以协同运行。

## 2026-05-26：报告证据包索引

目标：把当前所有可用于 final report / portfolio 的功能证据集中整理。

产物：`docs/evidence-index.md`

内容：已完成功能、关键测试结果、模型与数据策略、仍需真实数据后完成的工作、外部来源链接。

报告意义：后续写最终文档时，可以从该索引快速定位 replay、开源数据、TTS、质量筛选和端到端测试证据。

## 2026-05-27：自动记录：预生成语音资产

目标：从已有文本 manifest 批量生成或更新音频资产。

- 产物：`mvp/tts/precomputed_zh/manifest.json`
- cue 数：99
- 阶段统计：{'calm': 21, 'guidance': 15, 'evaluation': 20, 'overload': 28, 'ending': 15}
- 文本来源统计：{'manual_curated_translation': 99}
- LLM：qwen3.5:27b
- thinking：Ollama /api/chat think=false + Qwen /no_think
- TTS：qwen3_tts_official / Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
- textErrors：0
- audioErrors：0

报告意义：该条为脚本自动生成的过程摘要，用于追踪文本/TTS 资产的来源、质量筛选和错误情况。

## 2026-05-27：中文测试语音库重生成

目标：把当前测试阶段使用的语音文本从英文改为中文，并重新生成对应音频，便于后续中文演示、屏幕录制和报告材料统一。

方法：

- 以 `mvp/tts/precomputed/manifest.json` 中已经通过质量检查的 99 条英文 cue 为基础。
- 人工策展翻译为中文，保留原始英文 `originalText`，并把 `textSource` 标记为 `manual_curated_translation`。
- 翻译策略保持“温柔、系统化、轻微控制感”的睡眠助手语气，同时避免把语音写成医疗说明、真实身体指令或数据播报。
- 使用 Qwen3-TTS 官方 VoiceDesign 模型重新生成中文 wav。
- 通过临时服务端配置 `TTS_PRECOMPUTED_DIR=mvp/tts/precomputed_zh` 测试 `/api/voice-cue` 和音频静态资源访问。

结果：

- 中文文本库：`mvp/tts/precomputed_zh/manifest_text_zh.json`
- 中文音频库：`mvp/tts/precomputed_zh/manifest.json`
- 测试报告：`artifacts/test-runs/chinese_precomputed_voice_test/测试报告.json`
- cue 数：99
- 阶段统计：calm 21、guidance 15、evaluation 20、overload 28、ending 15
- 音频数量：99 个 wav
- 采样率：全部 24000Hz
- 时长范围：1.29 到 5.21 秒
- 平均时长：3.195 秒
- audioErrors：0
- 接口测试：calm、guidance、evaluation、overload、ending 五个阶段均返回中文文本和可访问的 wav。

报告意义：该步骤把语音层从英文测试资产推进为中文演示资产。它保留英文原文作为生成溯源，同时让最终 portfolio 能说明：文本经过质量筛选、人工翻译、TTS 重生成和接口测试，不是临场随意替换。
