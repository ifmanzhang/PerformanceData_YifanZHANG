# Guided Baseline / 睡眠基线 — 项目实现指引

## 0. 核心概念

这是一场约五分钟上下的坐姿静默 performance。表演者坐着、不说话，机器是唯一说话者。系统外观接近 Siri 式语音助手：屏幕上只有一个 logo / 光点 / assistant orb，以及非常简单的呼吸状动画；没有 dashboard、具体数值、字幕、进度条或错误文本。

作品来自一个失眠悖论：越强迫自己睡着，越要求自己不要动、不要紧张、必须放松，身体反而越警觉，越无法入睡。系统表面上在帮助表演者放松，实际不断把“自然呼吸”“保持静止”“身体放松”变成可计算、可比较、可纠正的目标。

它也回应 Goodhart's Law / 古德哈特定律：

> 当一个衡量指标成为目标，它就不再是一个好的衡量指标。

在作品中，baseline、稳定、平静本来只是身体状态的描述；一旦它们成为系统目标，表演者就开始表演平静、追求正确姿势、控制自己不要动。测量不再只是观察，而开始制造紧张。

一句话：

> 一个睡眠语音助手试图让人放松入睡，却把呼吸和姿势变成隐藏标准；系统越温柔地纠正，身体越难自然放松。

---

## 1. 表演与视觉形式

表演关系很简单：

- 人：坐姿、沉默，用呼吸、微小紧张、短暂停顿、姿势偏移回应系统。
- 机器：唯一说话者，用语音、logo 动画和声音环境回应身体数据。
- 屏幕：只显示 assistant logo / orb 的状态，不显示数值、字幕或操作界面。

视觉原则：

- 呼吸接近平稳时，logo 缓慢、柔和、圆润地明暗起伏。
- 呼吸变快或不稳定时，logo 跳动频率增高，脉冲变急。
- 姿势偏移、头肩紧张或坐立不安时，logo 出现漂移、收紧、抖动或轻微失衡。
- 内部数据可以很复杂，但现场画面只给“反应”，不解释原因。

---

## 2. 数据来源

现场数据只使用两类：

1. 呼吸数据  
   腹部手机加速度计读取身体起伏，作为 breathing proxy。它不声称医学准确，只为作品提供可反应的呼吸节奏、稳定度和信号置信度。

2. 摄像头姿势数据  
   摄像头读取上半身姿态与 movement energy，用于判断身体是否仍处在系统认为的“可休息 / 可测量”的状态。重点是 head / shoulder / torso / body present / movement energy，不做身份识别或表情识别。

传感器失败时可以 fallback：manual control、mock data 或 replay data 都可以维持演出结构。fallback 是现场可靠性设计，不是概念失败。

---

## 3. 实时与延迟响应原则

系统必须区分哪些内容需要实时响应，哪些可以延迟。

### 3.1 必须实时或近实时

这些响应直接影响观众对“身体被系统感知”的理解：

- logo pulse rate 跟随呼吸频率变化。
- logo jitter / drift / edge sharpness 跟随呼吸稳定度与姿势稳定度变化。
- 背景音乐参数平滑变化：gain、filter、tremolo、noise、stereo width、compression。
- 摄像头 movement / posture metrics 影响 logo 和 stillness pressure。
- 状态机每 100–200ms 更新一次，用于驱动视觉和声音。

实时响应的目标不是科学精确，而是身体变化和系统反应之间要有可感知的连贯关系。

### 3.2 可以延迟

这些内容允许 1–5 秒延迟，因为它们更像系统“思考后说出一句话”：

- LLM 根据当前 stage 和 metrics 生成短句。
- TTS 合成语音。
- 语音文件写入缓存。
- 后端将 VoiceEvent 推送到前端播放。

语音可以延迟，但不能失控随机。VoiceScheduler 应按 stage、evaluationIntensity、stillnessPressure 控制触发频率，并保留 fallback phrases / 预生成音频。

---

## 4. 约五分钟表演结构

时间不需要严格固定，整体在五分钟上下即可。每个阶段可根据排练调节。

| 阶段 | 作用 | 身体 / 数据 | 视觉 | 语音与声音 |
| --- | --- | --- | --- | --- |
| Calibration | 建立呼吸与姿势 baseline | 自然呼吸、坐定 | logo 慢速呼吸，柔和扩散 | 稀疏、安抚；音乐空灵 |
| Guidance | 系统开始温柔引导 | 呼吸开始被意识到，姿势被轻微约束 | logo 带一点建议性节奏 | “Try not to try.” 一类短句 |
| Evaluation | 放松变成目标 | 呼吸和姿势偏差提高 evaluationIntensity | logo 更亮、更紧、轻微抖动 | 语音更频繁；音乐出现 click / thin noise |
| Overload | 无法完成的平静 | baselineRecovery 接近完成又被内部重置 | logo 快速跳动、卡顿、漂移 | 句子变短、重复；声音变窄、急促、压抑 |
| Refusal | 人停止追随系统 | 表演者不再努力配合 | logo 放慢、悬停或淡出 | 高频切掉，只剩低频或静音 |

语音示例：

```text
You do not need to do anything.
Let the body become quiet.
Try not to try.
Stay with the quiet.
Do not move yet.
You are almost resting.
```

---

## 5. 系统数据流

主闭环：

```text
腹部起伏
→ phone accelerometer
→ BreathAnalyzer
→ breathRate / breathingStability / baselineDeviation / confidence
→ PerformanceMachine
→ ReactionEngine
→ logo pulse / jitter / drift
→ AudioEngine
→ 表演者身体状态变化
```

姿势闭环：

```text
camera
→ PostureAnalyzer
→ bodyPresent / movementEnergy / postureStability / torsoLean / headTilt
→ stillnessPressure
→ logo drift / edgeSharpness / LLM prompt summary
```

语音闭环：

```text
PerformanceState summary
→ VoiceScheduler
→ LLM short sentence
→ TTS audio
→ VoiceEvent playback
→ save text + audio + timestamp
```

记录闭环：

```text
metrics + reaction + audio params + voice events
→ JSONL / CSV / cached audio
→ replay mode
→ 后期视频制作的数据图层、可视化、剪辑节奏参考
```

---

## 6. 核心状态与指标

```ts
export type PerformanceStage =
  | "idle"
  | "calibration"
  | "guidance"
  | "evaluation"
  | "overload"
  | "refusal"
  | "end";

export type PerformanceState = {
  stage: PerformanceStage;
  elapsedMs: number;

  breathRateBpm: number | null;
  breathingStability: number;  // 0-100
  baselineDeviation: number;   // 0-100
  breathConfidence: number;    // 0-1

  movementEnergy: number;      // 0-100
  postureStability: number;    // 0-100
  bodyPresent: boolean;

  baselineRecovery: number;    // internal only
  evaluationIntensity: number; // 0-1
  stillnessPressure: number;   // 0-1

  visualReaction: VisualReactionState;
  audioPressure: number;       // 0-1
  currentVoiceEvent?: VoiceEvent;
};

export type VisualReactionState = {
  pulseRate: number;
  pulseAmplitude: number;
  brightness: number;
  edgeSharpness: number;
  jitter: number;
  driftX: number;
  driftY: number;
};

export type VoiceEvent = {
  id: string;
  timestamp: number;
  stage: PerformanceStage;
  text: string;
  audioFile: string;
  source: "llm" | "cached" | "fallback";
  metricsSummary: {
    breathing: "stable" | "wavering" | "irregular";
    posture: "settled" | "tense" | "drifting" | "missing";
    pressure: "low" | "medium" | "high";
  };
};
```

---

## 7. 语音系统

语音是主要界面，但不需要逐帧实时。推荐流程：

```text
metrics summary
→ VoiceScheduler decides if a line is needed
→ LLM generates 3-9 word sentence
→ TTS generates audio
→ cache audio + text
→ playback
→ log VoiceEvent
```

LLM 输入不传完整原始数据，只传语义摘要：

```json
{
  "stage": "evaluation",
  "breathing": "wavering",
  "posture": "tense",
  "pressure": "medium",
  "tone": "calm sleep assistant",
  "maxWords": 9
}
```

生成原则：

- 句子短，像睡眠助手，不像报错系统。
- 不说数值，不说 technical terms。
- 前期稀疏、温柔；后期更短、更近、更重复。
- LLM / TTS 失败时使用 fallback phrases 和预生成音频。

所有语音产物必须保存：

- generated text
- prompt summary
- TTS audio file
- voice source: llm / cached / fallback
- trigger timestamp
- playback timestamp
- 对应 stage 与 metrics snapshot

这些材料用于 replay、documentation 和后期视频制作。

---

## 8. 声音系统

背景音乐用音频 stems 和 Web Audio 参数映射实现连续变化。

推荐 stems：

```text
calm_air_loop.wav
warm_drone_loop.wav
pulse_texture_loop.wav
pressure_noise_loop.wav
overload_highfreq_loop.wav
low_rumble_loop.wav
```

实现方式：

1. 所有 stems 同步循环播放，不频繁 start / stop。
2. evaluationIntensity 控制每条 stem 的 gain。
3. gain 使用 ramp 平滑变化，避免硬切。
4. master bus 控制 filter、compression、stereo width、reverb、tremolo。
5. TTS 独立 voice bus，出现时对音乐轻微 ducking。

声音变化方向：

- early：宽、慢、空灵、柔和。
- middle：click、thin noise、轻微 tremolo 进入。
- late：空间变窄、压缩增强、高频变尖、重复感增强。

紧张感来自“变窄、变密、变近、变重复”，不靠单纯变大声。

---

## 9. 日志、缓存与 Replay

每 100–200ms 记录一次状态；每次语音事件单独记录。日志用于复现演出，也用于后期制作。

状态日志示例：

```json
{
  "timestamp": 1710000000000,
  "stage": "evaluation",
  "breathRateBpm": 11.8,
  "breathingStability": 62.1,
  "baselineDeviation": 34.2,
  "breathConfidence": 0.76,
  "movementEnergy": 12.4,
  "postureStability": 58.7,
  "bodyPresent": true,
  "baselineRecovery": 54.3,
  "evaluationIntensity": 0.48,
  "stillnessPressure": 0.41,
  "visualReaction": {
    "pulseRate": 1.7,
    "jitter": 0.28,
    "edgeSharpness": 0.54
  },
  "audioState": {
    "calmGain": 0.62,
    "pressureGain": 0.31,
    "tremoloRate": 5.4
  }
}
```

语音日志示例：

```json
{
  "timestamp": 1710000002300,
  "stage": "evaluation",
  "text": "Try not to try.",
  "audioFile": "public/audio/voice-cache/evaluation_042.wav",
  "source": "llm",
  "metricsSummary": {
    "breathing": "wavering",
    "posture": "tense",
    "pressure": "medium"
  }
}
```

Replay mode 应能复现：

- logo 反应
- audio parameter changes
- TTS 触发时间
- cached / fallback voice playback
- 后期制作所需 CSV / JSON 导出

---

## 10. 推荐技术结构

```text
guided-baseline/
  server/
    src/
      index.ts
      phyphoxClient.ts
      websocket.ts
      logger.ts
      llmVoice.ts
      ttsClient.ts
      replayServer.ts

  client/
    src/
      state/
        performanceMachine.ts
        reactionEngine.ts
        voiceScheduler.ts

      sensors/
        breathSource.ts
        breathAnalyzer.ts
        cameraPostureSource.ts
        postureAnalyzer.ts
        mockSources.ts
        replaySource.ts

      audio/
        audioEngine.ts
        musicTransitionEngine.ts
        ttsVoicePlayer.ts

      visual/
        AssistantLogo.tsx
        LogoMotion.ts
        HiddenDebugPanel.tsx

      logging/
        clientLogger.ts
        replayLoader.ts

  public/
    audio/
      stems/
      voice-cache/
      fallback-voice/

  logs/
```

前端负责实时视觉和音频响应；后端负责传感器代理、LLM / TTS、缓存和日志。API key 不放前端。

---

## 11. 开发顺序

1. Mock timeline  
   不接硬件，先跑完整五分钟结构：stage、evaluationIntensity、stillnessPressure、logo 反应、声音压力。

2. Assistant logo  
   实现 pulse / jitter / drift / edgeSharpness。现场模式只显示 logo，debug mode 才显示数值。

3. Audio engine  
   同步 stems，完成 calm → pressure 的无缝过渡和 TTS voice bus。

4. Breath pipeline  
   接 phone accelerometer，输出 breathRate、breathingStability、baselineDeviation、confidence。

5. Camera posture pipeline  
   接摄像头，输出 movementEnergy、postureStability、bodyPresent。

6. Voice pipeline  
   VoiceScheduler → LLM → TTS → cache → playback → log。必须有 fallback phrases / fallback audio。

7. Logging / replay  
   保存状态、语音文本、音频文件、视觉参数、声音参数。Replay 能复现视觉、声音和语音触发。

8. Rehearsal tuning  
   调整阈值、语音频率、声音曲线、logo 反应幅度和 overload 的不可完成感。

---

## 12. 交付材料

- 约五分钟上下的 live performance 视频
- 系统图与 signal flow
- 代码与关键模块说明
- 传感器测试记录
- assistant logo 视觉迭代
- 声音设计与 stem mapping
- LLM 短句、TTS 音频与 voice cache
- JSONL / CSV 日志与 replay 说明
- 后期视频制作中如何使用隐藏数据的说明
- reflection：失眠悖论、Goodhart 定律、数据化睡眠、身体规训
