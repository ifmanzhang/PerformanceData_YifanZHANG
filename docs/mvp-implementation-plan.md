# Guided Baseline MVP 实现计划

## 1. MVP 目标

先做一个不接硬件、不接真实数据的最小可行产物。

这一版只验证作品体验是否成立：

- 一个类似 Siri 的 assistant logo / orb 在屏幕中央变化。
- 约五分钟的预设时间线可以自动运行。
- 视觉从平静逐渐变得紧张。
- 声音从空灵放松逐渐变得急促压抑。
- 机器语音按阶段说出预写短句。
- 每个模块都能单独测试。

第一版不做真实手机传感器、摄像头识别、LLM、TTS API。先用 mock 参数和预写素材把骨架跑通。

---

## 2. MVP 包含什么

### 必做

1. **TimelinePlayer**
   - 预设一个约五分钟的演出时间线。
   - 自动推进阶段：calm → guidance → evaluation → overload → ending。
   - 每一帧输出 mock 状态：`pressure`、`pulseRate`、`jitter`、`drift`、`voiceCue`。

2. **AssistantLogo**
   - 屏幕中央显示一个 logo / orb。
   - 根据参数改变：跳动频率、亮度、抖动、漂移、边缘紧张感。
   - 不显示数值、字幕、进度条或 dashboard。

3. **AudioEngine**
   - 先用 Web Audio / Tone.js 生成基础声音。
   - 至少包含：ambient pad、low drone、click、noise、tremolo。
   - 用 `pressure` 控制声音从放松到压迫。

4. **VoiceCuePlayer**
   - 使用预写语音短句。
   - 第一版可以用浏览器 `speechSynthesis` 播放。
   - 不接 LLM，不接真实 TTS API。

5. **Logger**
   - 记录 timeline 当前阶段。
   - 记录 logo 参数。
   - 记录声音压力参数。
   - 记录每次语音触发的文本和时间。

6. **Module Test Modes**
   - 每个模块都有独立测试方式。
   - 不需要跑完整系统也能检查单个模块是否工作。

### 暂不做

- 手机加速度计。
- 摄像头姿势识别。
- 真实 LLM 生成。
- 真实 TTS 合成。
- 完整 replay 系统。
- 复杂数据分析。
- 最终声音素材制作。

---

## 3. 模块测试方式

### 3.1 Logo Test

目的：确认视觉反应成立。

测试内容：

- 用滑块控制 `pulseRate`。
- 用滑块控制 `jitter`。
- 用滑块控制 `drift`。
- 用滑块控制 `brightness`。
- 检查 logo 是否从平静变得紧张。

通过标准：

- 不看数值也能感到状态变化。
- 动画稳定，不闪屏，不突兀跳变。

---

### 3.2 Audio Test

目的：确认声音压力变化成立。

测试内容：

- 用一个 `pressure` 滑块从 0 推到 1。
- 0 时声音空灵、慢、宽。
- 1 时声音更窄、更密、更压迫。

通过标准：

- 声音变化是连续的，不是突然切换。
- 紧张感来自变密、变窄、变重复，而不是单纯变大声。

---

### 3.3 Voice Test

目的：确认机器语音的语气和节奏成立。

测试内容：

- 按按钮触发不同阶段短句。
- calm 阶段句子稀疏、安抚。
- overload 阶段句子更短、更频繁、更像命令。

预写短句示例：

```text
You do not need to do anything.
Let the body become quiet.
Try not to try.
Stay with the quiet.
Do not move yet.
You are almost resting.
```

通过标准：

- 语音像睡眠助手，不像系统报错。
- 不出现数值、诊断、错误提示。

---

### 3.4 Timeline Test

目的：确认无硬件情况下能跑完整演出。

测试内容：

- 点击 start。
- 系统自动运行约五分钟。
- logo、声音、语音随阶段变化。
- ending 阶段逐渐安静或淡出。

通过标准：

- 不需要手动干预也能完整跑完。
- 五分钟结构清楚：平静 → 引导 → 评价 → 过载 → 结束。

---

### 3.5 Logger Test

目的：确认后续制作需要的信息能保存。

测试内容：

- 运行 timeline。
- 导出 JSONL 或 JSON。
- 检查是否包含：
  - timestamp
  - stage
  - pressure
  - logo parameters
  - audio parameters
  - voice text
  - voice trigger time

通过标准：

- 能从日志看出每个阶段发生了什么。
- 语音触发时间和文本可用于后期视频制作。

---

## 4. 实施顺序

### Step 1 — 项目骨架

建立最小前端项目。

需要完成：

- 页面能打开。
- 有一个全屏黑 / 深色背景。
- 有一个 start 按钮。
- 有 debug mode 开关。

---

### Step 2 — 静态 Logo

先做一个居中的 assistant orb。

需要完成：

- 居中显示。
- 有柔和 glow。
- 有基础呼吸式缩放。

---

### Step 3 — Logo 参数控制

让 logo 可以被参数驱动。

需要完成：

- `pulseRate`
- `brightness`
- `jitter`
- `drift`
- `edgeSharpness`

先用滑块测试，不接 timeline。

---

### Step 4 — TimelinePlayer

制作预设五分钟时间线。

需要完成：

- calm
- guidance
- evaluation
- overload
- ending

每个阶段输出一组 mock 参数。

---

### Step 5 — Logo 接入 Timeline

把 timeline 输出接到 logo。

需要完成：

- calm 时 logo 慢。
- evaluation 时 logo 更亮、更紧。
- overload 时 logo 快速跳动、抖动。
- ending 时 logo 放慢或淡出。

---

### Step 6 — AudioEngine

做基础声音系统。

需要完成：

- ambient pad
- drone
- click
- noise
- tremolo
- `pressure` 控制声音变化

先用滑块测试，再接 timeline。

---

### Step 7 — VoiceCuePlayer

做预写语音短句。

需要完成：

- 每个阶段有 2–4 句短句。
- 按阶段触发。
- 可以用 `speechSynthesis` 播放。
- 每次触发写入日志。

---

### Step 8 — Logger

记录 MVP 运行过程。

需要完成：

- 每 200ms 记录一次状态。
- 每次语音触发单独记录。
- 支持导出 JSON。

---

### Step 9 — 整合 Demo

做一个一键运行版本。

需要完成：

- 点击 start 后自动跑完。
- 现场模式只显示 logo。
- debug mode 才显示参数和阶段。
- 演出结束后可以导出日志。

---

## 5. MVP 完成标准

MVP 完成后应达到：

- 不接任何硬件也能运行。
- 不依赖真实数据也能呈现作品结构。
- logo、声音、语音三个核心模块都能单独测试。
- 五分钟 timeline 能自动跑完。
- 观众能感到系统从安抚逐渐变得压迫。
- 所有语音文本和触发时间都被保存。
- 后续可以逐步替换 mock 输入为真实传感器、摄像头、LLM 和 TTS。

