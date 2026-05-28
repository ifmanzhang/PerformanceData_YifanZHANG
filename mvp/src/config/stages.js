export const STAGE_ORDER = ["calm", "guidance", "evaluation", "overload", "ending"];

export const STAGE_LABELS = {
  calm: "安静进入",
  guidance: "引导放松",
  evaluation: "评估",
  overload: "过载",
  ending: "结束",
  "logo-test": "标志测试",
  "audio-test": "音乐测试",
  "voice-test": "语音测试",
};

export const STAGES = [
  { name: "calm", duration: 55_000, pressure: [0.03, 0.12], pulse: [0.22, 0.28], jitter: [0, 0.04], drift: [0, 0.03], brightness: [0.48, 0.56], edge: [0.08, 0.14] },
  { name: "guidance", duration: 65_000, pressure: [0.12, 0.28], pulse: [0.28, 0.46], jitter: [0.03, 0.1], drift: [0.02, 0.08], brightness: [0.54, 0.68], edge: [0.12, 0.26] },
  { name: "evaluation", duration: 80_000, pressure: [0.28, 0.62], pulse: [0.46, 1.05], jitter: [0.1, 0.36], drift: [0.08, 0.22], brightness: [0.66, 0.95], edge: [0.26, 0.58] },
  { name: "overload", duration: 75_000, pressure: [0.62, 0.96], pulse: [1.05, 2.45], jitter: [0.36, 0.9], drift: [0.2, 0.48], brightness: [0.94, 1.24], edge: [0.58, 0.96] },
  { name: "ending", duration: 25_000, pressure: [0.96, 0.08], pulse: [2.1, 0.16], jitter: [0.65, 0], drift: [0.34, 0], brightness: [0.84, 0.22], edge: [0.78, 0.05] },
];

export const VOICE_CUES = {
  calm: [
    "你现在什么都不需要做。",
    "让身体慢慢安静下来。",
  ],
  guidance: [
    "试着不要用力去尝试。",
    "让呼吸自己到来。",
    "就停在这里。",
  ],
  evaluation: [
    "你做得很好。",
    "把用力的部分放软一点。",
    "让安静变得更容易。",
  ],
  overload: [
    "先不要动。",
    "几乎已经进入休息。",
    "和这份安静待在一起。",
    "你已经很接近了。",
  ],
  ending: [
    "我还在这里。",
    "你可以停止尝试了。",
  ],
};

export const CUE_OFFSETS = {
  calm: [0.2, 0.68],
  guidance: [0.12, 0.48, 0.78],
  evaluation: [0.14, 0.42, 0.72],
  overload: [0.08, 0.3, 0.56, 0.78],
  ending: [0.2, 0.68],
};

export const STEM_TRACKS = [
  { id: "calmPad", path: "./audio/stems/calm_pad_loop.ogg" },
  { id: "contemplation", path: "./audio/stems/contemplation_bed.mp3" },
  { id: "airBells", path: "./audio/stems/air_bells_loop.ogg" },
  { id: "pressureCavern", path: "./audio/stems/pressure_cavern_loop.ogg" },
];

export const REPLAY_METRIC_FIELDS = [
  "breathPhase",
  "breathRate",
  "breathingStability",
  "heartRateBpm",
  "rrInterval",
  "hrvProxy",
  "cardiacArousal",
  "baselineDeviation",
  "pressure",
];

export const AUDIO_SUSPEND_DELAY_MS = 700;
export const DEFAULT_REPLAY_URL = "./data/replay/demo_replay.json";

export function stageLabel(stageName) {
  return STAGE_LABELS[stageName] || stageName;
}

export function totalDuration() {
  return STAGES.reduce((sum, stage) => sum + stage.duration, 0);
}

export function findStage(stageName) {
  return STAGES.find((stage) => stage.name === stageName) || STAGES[0];
}
