# 最终项目计划：睡眠基线

## 1. 项目目标

本项目最终是一场约五分钟的 data performance：一个“睡眠助手”使用离线采集的呼吸与心电图数据建立身体基线，并在表演中不断引导、评价和纠正表演者。系统表面上在帮助入睡，实际却把“放松”变成一个必须被测量、达标和完成的任务。

一句话概念：

> 一个睡眠助手试图让身体回到“理想基线”，却把呼吸和心跳变成无法完成的放松标准。

作品的核心理论是古德哈特定律：当一个衡量指标成为目标，它就不再是一个好的衡量指标。基线、平静和稳定本来只是身体状态的描述；一旦系统把它们变成目标，表演者就开始“表演平静”，测量也开始制造紧张。

## 2. 核心策略

最终系统使用离线生理数据，而不是依赖现场不稳定的传感器连接。这不是退而求其次，而是作品概念的一部分：过去被记录下来的身体成为“基线幽灵”，在现在的表演中返回，并要求当前身体服从它。

| 数据 | 表演作用 | 概念意义 |
| --- | --- | --- |
| 呼吸 | 半可控信号，表演者可以努力放慢或稳定。 | 可见的“努力放松”。 |
| ECG / 心率 | 更难直接控制，能暴露隐藏紧张。 | 身体对完美自控的抵抗。 |

最重要的张力是：表演者可能让呼吸看起来平稳，但心电指标仍然显示紧张，于是系统继续温柔地纠正，形成失眠式循环。

### 无真实数据阶段的数据策略

当前采用“双轨推进”：合成数据先保证表演系统能跑通，开源生理数据再验证 ECG + respiration 预处理能否应对真实噪声。学校数据到手后，只替换 replay 输入，不改视觉、声音、语音和日志结构。

| 数据来源 | 当前用途 | 可以证明什么 | 不能做什么 |
| --- | --- | --- | --- |
| 合成数据 | 生成五分钟 `demo_replay.json`，开发 replay、调 orb / 声音 / 语音节奏。 | 系统结构、mapping、fallback 和表演曲线可运行。 | 不能声称为真实身体数据。 |
| 开源数据 | 使用 PhysioNet 等数据集测试 R peak、RR interval、HRV proxy、呼吸 proxy。 | 预处理流程能面对真实噪声和不同采样格式。 | 不能伪装成表演者本人数据。 |
| 学校/本人数据 | 最终表演 replay 的主要材料。 | 作品与表演者身体经验直接相关。 | 不做医学诊断，不公开 raw ECG。 |

优先测试数据集：BIDMC PPG and Respiration Dataset、CEBSDB、Fantasia Database、Simultaneous physiological measurements。Portfolio 中必须明确说明开源数据只用于算法测试和调参；若最终只能使用开源数据，作品概念需要调整为“他人身体基线如何训练睡眠助手”，而不是个人身体自传。

## 3. 作业要求对应

| 作业要求 / 评分关注 | 项目如何回应 | Portfolio 证据 |
| --- | --- | --- |
| LO1：构建使用数据或机器学习的创作系统 | 离线呼吸 + ECG 数据经过预处理，驱动 orb、声音、语音和日志。 | 系统图、代码、replay JSON、演出视频。 |
| LO2：分析观众参与/反馈并调整表演 | 排练中收集观众观察，记录他们何时感到“帮助变成控制”，并据此调整语音频率、声音压力和视觉变化。 | 观众反馈表、排练记录、修改前后截图/日志。 |
| LO3：批判性评估技术、艺术、伦理 | 反思量化睡眠、Goodhart’s Law、生理数据作为 proxy、数据隐私和非医学诊断边界。 | 个人 reflection、伦理说明、参考文献。 |
| 技术与表演 | 系统不只是展示数据，而是让数据成为表演压力来源。 | live view 视频、debug 日志、mapping 表。 |
| 可靠性 | 使用离线 replay，保留 mock timeline、fallback phrase、浏览器语音、Web Audio fallback。 | fallback 说明、测试记录。 |
| 可读性 | 现场不显示数字，但观众能感到身体数据影响 orb、声音和语音。 | 观众反馈、系统图、数据到输出的映射说明。 |

## 4. 课程内容对应与证据

| 周次 | 课程领域 | 项目实现 | 应放入文档的证据 |
| --- | --- | --- | --- |
| Week 1 | 表演、liveness、身体/机器/观众关系 | 人与系统共同构成现场；baseline 像训练/排练。 | 概念说明、表演结构图。 |
| Week 2 | 生成文本、LLM、文本作为指令 | 睡眠助手短句作为表演 score。 | 语音 prompt、fallback 短句、TTS 记录。 |
| Week 3 | 传感器流、平滑、映射、连续/离散控制 | 离线数据作为 replay sensor stream；平滑、归一化、派生指标。 | preprocessing 代码、数据图、mapping 表。 |
| Week 4 | 声音合成与生成音频 | stems + Web Audio；心率控制 click，HRV 控制 tremolo/filter。 | 声音映射表、音频参数日志。 |
| Week 5 | 生成视觉、feedback system | 选择实时数据驱动 orb，而非 live diffusion；可附一个 diffusion 小实验作为过程对比。 | 视觉迭代截图、取舍说明。 |
| Week 6 | 心理生理学、呼吸、ECG、baseline、confidence | 核心数据层：呼吸、R peak、RR interval、HRV proxy、signal confidence。 | 数据采集记录、指标解释、伦理说明。 |
| Week 7 | 符号音乐、规则、token、生成结构 | 状态机、voice scheduler、RR interval click pattern 作为 symbolic score。 | 状态机图、voice scheduler 代码。 |
| Week 8 | 动作声化、具身映射 | 坐姿、呼吸、心跳作为内部运动；可加摄像头 movement energy / posture drift。 | 姿态或微动作映射说明。 |
| Week 9 | 观众反馈、记录与评估 | 排练反馈进入调参过程。 | feedback notes、调整记录。 |

## 5. 表演结构

| 阶段 | 作用 | 数据状态 | 输出状态 |
| --- | --- | --- | --- |
| Calibration / Baseline | 建立被记录的理想身体。 | 呼吸和心电接近 baseline。 | orb 慢、柔和；声音宽；语音稀疏。 |
| Guidance | 系统开始帮助。 | 呼吸节奏变成可跟随目标。 | orb 温和同步；语音类似 “Try not to try.” |
| Evaluation | 平静变成分数。 | baseline deviation、心率上升、HRV 下降、呼吸不稳增加 pressure。 | orb 更亮更紧；click/noise 进入；语音更频繁。 |
| Overload | 身体无法满足系统。 | 呼吸与 ECG 冲突或偏离。 | orb 抖动漂移；声音变窄；短句重复。 |
| Refusal / Ending | 表演者停止追随指标。 | 系统仍评价，但评价失去权威。 | orb 放慢、悬停或淡出；“You may stop trying.” |

## 6. 数据采集与处理

建议采集五段离线数据：

| 录制 | 时长 | 状态 | 用途 |
| --- | ---: | --- | --- |
| `baseline_rest` | 3-5 分钟 | 自然坐着 | 定义基线 |
| `guided_relaxation` | 3-5 分钟 | 听睡眠助手语音 | 前期引导 |
| `evaluated_stillness` | 3-5 分钟 | 尝试保持稳定 | 评价阶段 |
| `disrupted` | 2-4 分钟 | 屏息、轻微紧张、姿态变化 | 过载阶段 |
| `refusal` | 2-3 分钟 | 停止配合 | 结尾 |

呼吸指标：

- `breathPhase`：驱动 orb 呼吸起伏。
- `breathRate`：控制 pulse rate。
- `breathDepth`：控制扩张幅度。
- `breathingStability`：控制 jitter、drift、语音频率。
- `breathPause`：触发提醒或 pressure 上升。
- `breathConfidence`：信号质量。

ECG 指标：

- `rPeaks`：R 峰检测。
- `rrInterval`：相邻心跳间隔。
- `heartRateBpm`：心率。
- `heartRateStability`：心率稳定度。
- `hrvProxy`：简化 HRV，例如 RMSSD 或短窗口 RR 波动。
- `cardiacArousal`：心率上升 + HRV 下降的综合压力。
- `ecgConfidence`：R 峰检测可靠性。

综合压力：

```text
pressure =
  baselineDeviation
+ breathingInstability
+ cardiacArousal
+ breathHeartMismatch
+ measurementUncertainty
```

所有指标都作为艺术 proxy，不作为医学诊断。

## 7. Replay 数据格式

预处理脚本输出统一 JSON，供 MVP 加载：

```json
{
  "meta": {
    "source": "offline breath and ECG recording",
    "sampleRate": 50,
    "notes": "artistic physiological replay data, not medical analysis"
  },
  "frames": [
    {
      "time": 12.4,
      "stageHint": "evaluation",
      "breathPhase": 0.62,
      "breathRate": 10.8,
      "breathingStability": 0.74,
      "heartRateBpm": 82.1,
      "rrInterval": 0.73,
      "hrvProxy": 0.31,
      "cardiacArousal": 0.56,
      "baselineDeviation": 0.34,
      "pressure": 0.48
    }
  ]
}
```

字段名保留英文，说明文档保持中文。

## 8. 映射计划

现场屏幕保持极简，不显示 ECG 图、数字读数或 dashboard。后台数据真实存在，但现场只呈现它对身体和系统的影响。

| 数据特征 | 视觉映射 | 声音映射 | 语音映射 |
| --- | --- | --- | --- |
| 呼吸 phase/rate | orb 膨胀、收缩、pulse rate | pad/filter 呼吸式变化 | 不直接触发 |
| 呼吸不稳定 | jitter、drift 增加 | noise 和轻微不稳定 | 更频繁纠正 |
| 心率上升 | 内部光点/pulse 密度增加 | click 密度增加 | 更偏评价 |
| HRV 下降 | edge sharpness 增加 | tremolo、filter、空间收窄 | 句子变短 |
| 呼吸/心跳不一致 | 外部平静，内部不稳定 | calm pad 下隐藏 click/noise | “Almost resting.” |
| confidence 下降 | 卡顿、迟疑、漂移 | dropout 式变薄 | 重复 fallback 短句 |

## 9. 当前 MVP 接入方式

现有 MVP 已具备基础：

- `TimelinePlayer`：阶段结构。
- `AssistantLogo`：中心 orb。
- `AudioEngine`：pressure-driven stems 和 Web Audio。
- `VoiceCuePlayer`：本地 Qwen3.5 / Qwen3-TTS + fallback。
- `Logger`：状态与语音事件导出。
- `Live View`：干净表演模式。

新增内容：

```text
data/raw/
data/processed/
scripts/data/preprocess_replay.py
mvp/data/replay/demo_replay.json
mvp/src/main.js 中加入 replayDataSource
```

原则：

1. 保留 mock timeline 作为 fallback。
2. 增加 replay mode，默认先加载合成 replay。
3. 用 replay 中的 `pressure`、`breathRate`、`heartRateBpm`、`hrvProxy` 驱动现有视觉、声音和语音。
4. 日志同时记录 physiological metrics 和 reaction parameters。

### 文本与语音生成策略

语音链路分成“现场可运行版本”和“报告展示版本”。当前默认升级为本地 `qwen3.5:27b` 生成短句，TTS 使用 Qwen3-TTS VoiceDesign；Kokoro、fallback phrase bank 和浏览器语音保留为快速备案。如果需要更高质量或更强实时生成能力，可以接入 API，或在更高级别 GPU 上运行更大的文本模型 / TTS 模型。

报告、示例视频和 portfolio 测试可以使用预生成或缓存文本/语音：先用更高质量模型生成睡眠助手短句和 TTS 音频，再在演出 replay 中播放。这样既证明系统有实时生成与 fallback 能力，也保证提交材料中的语音质量足够稳定、细腻。这个原则同样适用于文本模型：现场使用较小本地模型或 fallback 保证可控，报告可以展示由更强模型生成并筛选后的高质量语句。

所有模型缓存必须留在项目目录内：Ollama 使用 `mvp/.ollama-models`，Hugging Face / Transformers / MLX / pip 缓存使用 `mvp/.model-cache`，Qwen3-TTS 项目虚拟环境使用 `mvp/.venv-qwen-tts`，预生成语音资产使用 `mvp/tts/precomputed`。本机为 24GB 统一内存，`qwen3.5:35b` 的 Ollama 包约 24GB，不适合作为默认；默认选择 `qwen3.5:27b` 作为本机可落地的高质量文本模型。

### 过程记录与报告证据

项目开发中的失败、修正和质量判断统一记录到 `docs/process-log.md`。最终报告不只展示最终作品，还应引用这些过程证据：传感器不稳定导致离线 replay 策略、Qwen3.5 关闭 thinking mode、Qwen3-TTS 本机性能限制、prompt 迭代、fallback 暴露的问题、100 条文本生成后的质量筛选等。

后续每次修改数据、模型、prompt、TTS、过滤规则、mapping 或表演结构时，都需要同步记录：

- 目标：为什么要改。
- 问题：出现了什么失败、噪声、质量风险或表演风险。
- 修正：改了哪个脚本、参数或文档。
- 产物：manifest、日志、截图、测试报告或视频路径。
- 报告意义：这个过程如何支持最终 portfolio / reflection。

## 10. 实现路线

1. **数据准备**  
   确认学校设备导出格式；采集 baseline 和 disrupted；记录采样率、列名、掉线情况。

2. **预处理脚本**  
   编写 `scripts/data/preprocess_replay.py`，完成呼吸平滑、R 峰检测、RR interval、HRV proxy、confidence、pressure 计算，并输出 replay JSON。

3. **接入 MVP**  
   在 `mvp/src/main.js` 增加 replay loader；mock / replay 可切换；导出日志增加身体指标。

4. **声音补强**  
   加入 ECG 驱动的 click density、HRV 驱动的 tremolo/filter narrowing、呼吸驱动的 pad/filter breathing。

5. **可选姿态层**  
   若时间允许，加入摄像头 movement energy / posture drift，补强动作与具身映射。

6. **排练调参**  
   用 live view 排练；调语音频率、pressure curve、声音密度和 orb 变化幅度。

7. **观众反馈**  
   至少收集一次排练反馈，并记录根据反馈做出的调整。

8. **最终文档**  
   整理系统图、数据处理、映射表、日志、截图、观众反馈、伦理说明和个人反思。

## 11. 可靠性与 Fallback

| 风险 | Fallback |
| --- | --- |
| 学校传感器连接不稳定 | 使用离线 replay |
| replay 文件失败 | 使用 mock timeline |
| Ollama / Qwen3.5 失败 | fallback phrase bank |
| Qwen3-TTS 失败 | 浏览器语音、Kokoro 或预生成音频 |
| 本地模型质量不足 | 报告示例使用预生成/缓存文本和语音 |
| 需要更强实时生成 | 接 API 或使用更高级别 GPU |
| 音频 stems 失败 | Web Audio drone/noise/click |
| 现场 UI 干扰 | 使用 live view；Escape / L 切换 |

这种可靠性设计应写进文档，作为作品系统的一部分，而不是隐藏成技术妥协。

## 12. 伦理与数据处理

- 生理数据本地保存。
- 作品不做医学诊断。
- 所有呼吸和心率指标都是艺术 proxy。
- 使用他人数据必须获得明确同意。
- 不公开 raw ECG，除非获得同意。
- 对外展示优先使用 processed metrics。
- 说明 assessment 后数据如何删除或归档。
- 睡眠助手语音避免医学诊断、症状、panic、clinical advice 等表达。

## 13. 观众反馈问题

排练时可问：

1. 你从哪个时刻开始觉得助手不再只是帮助？
2. 你能感觉到身体/数据和 orb / 声音之间的关系吗？
3. 不显示数字会让系统显得更亲密、更控制，还是更不清楚？
4. 语音让你感觉被照顾、被命令，还是两者都有？
5. 你认为表演者在努力完成什么？

## 14. 最终交付材料

- 表演视频，使用 live view。
- 项目 statement 和一句话概念。
- 离线数据到输出的系统图。
- 数据采集记录。
- 预处理说明和指标定义。
- 映射表。
- 关键代码说明。
- TTS / LLM / fallback 说明。
- 排练截图和日志。
- 观众反馈 / observation notes。
- bibliography 和课程 references。
- 个人 reflection：技术、艺术、伦理取舍。

## 15. 范围控制

保留：

- 极简 assistant orb。
- 呼吸 + ECG 作为核心数据。
- 离线 replay 作为稳定表演来源。
- 本地语音生成和 fallback。
- 日志和 replay 文档。

避免：

- 医疗 dashboard 美学。
- 在现场屏幕显示 ECG 图表。
- 为了覆盖课程而强行加入所有技术。
- 过度加入 live diffusion，除非它明确服务概念。
- 把系统做成没有批判性的 wellness product。

最强版本不是功能最多的版本，而是一个聚焦、可靠、由真实离线生理数据驱动的表演系统，让观众能感到“照护”如何逐渐变成“控制”。
