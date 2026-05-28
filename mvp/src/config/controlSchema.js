import { CUE_OFFSETS, STAGE_LABELS, STAGES } from "./stages.js";

export const CONTROL_GROUPS = [
  { id: "run", label: "运行" },
  { id: "timeline", label: "时间线" },
  { id: "visual", label: "视觉" },
  { id: "glassWind", label: "玻璃/风" },
  { id: "flowParticles", label: "流线/粒子" },
  { id: "audio", label: "音频" },
  { id: "voiceEvents", label: "语音/事件" },
  { id: "metricsReplay", label: "指标/回放" },
  { id: "logs", label: "日志" },
];

export const CONTROL_PARAMS = [
  { id: "visual.pulseRate", label: "脉冲频率", group: "visual", type: "number", min: 0.08, max: 3, step: 0.01, default: 0.35, target: "visual.pulseRate", applyMode: "manual-preview" },
  { id: "visual.pulseAmplitude", label: "脉冲幅度", group: "visual", type: "number", min: 0.02, max: 0.5, step: 0.01, default: 0.2, target: "visual.pulseAmplitude", applyMode: "manual-preview" },
  { id: "visual.brightness", label: "亮度", group: "visual", type: "number", min: 0.08, max: 1.5, step: 0.01, default: 0.58, target: "visual.brightness", applyMode: "manual-preview" },
  { id: "visual.edgeSharpness", label: "边缘锐度", group: "visual", type: "number", min: 0, max: 1.2, step: 0.01, default: 0.18, target: "visual.edgeSharpness", applyMode: "manual-preview" },
  { id: "visual.jitter", label: "抖动", group: "visual", type: "number", min: 0, max: 1.2, step: 0.01, default: 0, target: "visual.jitter", applyMode: "manual-preview" },
  { id: "visual.drift", label: "漂移", group: "visual", type: "number", min: 0, max: 0.9, step: 0.01, default: 0, target: "visual.drift", applyMode: "manual-preview" },
  { id: "visual.cssPulseScaleBase", label: "样式基础缩放", group: "visual", type: "number", min: 0.94, max: 1.04, step: 0.001, default: 0.985, target: "visual.cssPulseScaleBase", applyMode: "live" },
  { id: "visual.cssPulseScaleAmount", label: "样式缩放幅度", group: "visual", type: "number", min: 0, max: 0.06, step: 0.001, default: 0.018, target: "visual.cssPulseScaleAmount", applyMode: "live" },
  { id: "visual.jitterXAmount", label: "横向抖动量", group: "visual", type: "number", min: 0, max: 28, step: 0.1, default: 10, target: "visual.jitterXAmount", applyMode: "live" },
  { id: "visual.jitterYAmount", label: "纵向抖动量", group: "visual", type: "number", min: 0, max: 28, step: 0.1, default: 8, target: "visual.jitterYAmount", applyMode: "live" },
  { id: "visual.driftXAmount", label: "横向漂移量", group: "visual", type: "number", min: 0, max: 140, step: 1, default: 64, target: "visual.driftXAmount", applyMode: "live" },
  { id: "visual.driftYAmount", label: "纵向漂移量", group: "visual", type: "number", min: 0, max: 120, step: 1, default: 44, target: "visual.driftYAmount", applyMode: "live" },
  { id: "visual.cameraView", label: "视觉视角", group: "visual", type: "select", default: "near", target: "visual.cameraView", applyMode: "live", options: [
    { value: "near", label: "近景穹顶" },
    { value: "macro", label: "特写纹理" },
    { value: "wide", label: "远景完整" },
  ] },
  { id: "visual.frameOffsetX", label: "画面水平偏移", group: "visual", type: "number", min: -1.5, max: 1.5, step: 0.01, default: 0, target: "visual.frameOffsetX", applyMode: "live" },
  { id: "visual.frameOffsetY", label: "画面垂直偏移", group: "visual", type: "number", min: -1, max: 1, step: 0.01, default: 0, target: "visual.frameOffsetY", applyMode: "live" },
  { id: "visual.frameScale", label: "画面整体缩放", group: "visual", type: "number", min: 0.65, max: 1.35, step: 0.01, default: 1, target: "visual.frameScale", applyMode: "live" },
  { id: "visual.renderFps", label: "渲染帧率上限", group: "visual", type: "number", min: 12, max: 60, step: 1, default: 30, target: "visual.renderFps", applyMode: "live" },
  { id: "visual.readoutFps", label: "读数刷新率", group: "visual", type: "number", min: 1, max: 20, step: 1, default: 4, target: "visual.readoutFps", applyMode: "live" },
  { id: "visual.pixelRatioLimit", label: "像素倍率上限", group: "visual", type: "number", min: 0.75, max: 2, step: 0.05, default: 1.25, target: "visual.pixelRatioLimit", applyMode: "live" },
  { id: "visual.clinicalShiftStart", label: "临床转场起点压力", group: "visual", type: "number", min: 0, max: 1, step: 0.01, default: 0.62, target: "visual.clinicalShiftStart", applyMode: "live" },
  { id: "visual.clinicalShiftEnd", label: "临床转场终点压力", group: "visual", type: "number", min: 0, max: 1, step: 0.01, default: 0.96, target: "visual.clinicalShiftEnd", applyMode: "live" },
  { id: "visual.clinicalShiftAmount", label: "临床去饱和强度", group: "visual", type: "number", min: 0, max: 1.4, step: 0.01, default: 1, target: "visual.clinicalShiftAmount", applyMode: "live" },
  { id: "visual.cssSaturationBase", label: "基础饱和度", group: "visual", type: "number", min: 0.4, max: 2.2, step: 0.01, default: 0.94, target: "visual.cssSaturationBase", applyMode: "live" },
  { id: "visual.cssSaturationEdge", label: "边缘饱和度增量", group: "visual", type: "number", min: 0, max: 1.2, step: 0.01, default: 0.18, target: "visual.cssSaturationEdge", applyMode: "live" },
  { id: "visual.cssBrightnessBase", label: "基础明度", group: "visual", type: "number", min: 0.2, max: 1.6, step: 0.01, default: 0.86, target: "visual.cssBrightnessBase", applyMode: "live" },
  { id: "visual.cssBrightnessAmount", label: "明度增量", group: "visual", type: "number", min: 0, max: 0.9, step: 0.01, default: 0.22, target: "visual.cssBrightnessAmount", applyMode: "live" },

  { id: "glassWind.windBase", label: "基础风力", group: "glassWind", type: "number", min: 0, max: 1.2, step: 0.01, default: 0.68, target: "glassWind.windBase", applyMode: "live" },
  { id: "glassWind.windGustAmount", label: "阵风强度", group: "glassWind", type: "number", min: 0, max: 0.8, step: 0.01, default: 0.23, target: "glassWind.windGustAmount", applyMode: "live" },
  { id: "glassWind.windGustSpeed", label: "阵风速度", group: "glassWind", type: "number", min: 0.01, max: 3, step: 0.01, default: 0.39, target: "glassWind.windGustSpeed", applyMode: "live" },
  { id: "glassWind.windYawAmount", label: "横摆幅度", group: "glassWind", type: "number", min: 0, max: 1.6, step: 0.01, default: 0.72, target: "glassWind.windYawAmount", applyMode: "live" },
  { id: "glassWind.windYawSpeed", label: "横摆速度", group: "glassWind", type: "number", min: 0.01, max: 2, step: 0.01, default: 0.21, target: "glassWind.windYawSpeed", applyMode: "live" },
  { id: "glassWind.windPitchAmount", label: "俯仰幅度", group: "glassWind", type: "number", min: 0, max: 1.2, step: 0.01, default: 0.32, target: "glassWind.windPitchAmount", applyMode: "live" },
  { id: "glassWind.windPitchSpeed", label: "俯仰速度", group: "glassWind", type: "number", min: 0.01, max: 2, step: 0.01, default: 0.27, target: "glassWind.windPitchSpeed", applyMode: "live" },
  { id: "glassWind.membraneBaseTension", label: "膜基础张力", group: "glassWind", type: "number", min: 0, max: 1, step: 0.01, default: 0.26, target: "glassWind.membraneBaseTension", applyMode: "live" },
  { id: "glassWind.downwindBulge", label: "顺风鼓包", group: "glassWind", type: "number", min: 0, max: 0.6, step: 0.005, default: 0.2, target: "glassWind.downwindBulge", applyMode: "live" },
  { id: "glassWind.upwindCompression", label: "逆风压缩", group: "glassWind", type: "number", min: 0, max: 0.4, step: 0.005, default: 0.1, target: "glassWind.upwindCompression", applyMode: "live" },
  { id: "glassWind.rimFlutterAmount", label: "边缘颤动", group: "glassWind", type: "number", min: 0, max: 0.16, step: 0.001, default: 0.038, target: "glassWind.rimFlutterAmount", applyMode: "live" },
  { id: "glassWind.surfaceWaveAmount", label: "表面波纹", group: "glassWind", type: "number", min: 0, max: 0.2, step: 0.001, default: 0.07, target: "glassWind.surfaceWaveAmount", applyMode: "live" },
  { id: "glassWind.filmFlowSpeed", label: "薄膜流速", group: "glassWind", type: "number", min: 0, max: 3, step: 0.01, default: 0.46, target: "glassWind.filmFlowSpeed", applyMode: "live" },
  { id: "glassWind.filmFlowDirection", label: "液膜主流向", group: "glassWind", type: "number", min: -180, max: 180, step: 1, default: 92, target: "glassWind.filmFlowDirection", applyMode: "live" },
  { id: "glassWind.filmFlowCoherence", label: "流向一致性", group: "glassWind", type: "number", min: 0, max: 1, step: 0.01, default: 0.76, target: "glassWind.filmFlowCoherence", applyMode: "live" },
  { id: "glassWind.filmDiffusionAmount", label: "液膜晕染扩散", group: "glassWind", type: "number", min: 0, max: 1.5, step: 0.01, default: 0.38, target: "glassWind.filmDiffusionAmount", applyMode: "live" },
  { id: "glassWind.filmDripAmount", label: "液膜流淌感", group: "glassWind", type: "number", min: 0, max: 1.5, step: 0.01, default: 1.24, target: "glassWind.filmDripAmount", applyMode: "live" },
  { id: "glassWind.filmBandContrast", label: "衍射色带对比", group: "glassWind", type: "number", min: 0, max: 1.5, step: 0.01, default: 1.22, target: "glassWind.filmBandContrast", applyMode: "live" },
  { id: "glassWind.filmCoverage", label: "薄膜覆盖强度", group: "glassWind", type: "number", min: 0, max: 1.5, step: 0.01, default: 1.08, target: "glassWind.filmCoverage", applyMode: "live" },
  { id: "glassWind.filmSpeckleAmount", label: "液膜颗粒感", group: "glassWind", type: "number", min: 0, max: 1.5, step: 0.01, default: 0.86, target: "glassWind.filmSpeckleAmount", applyMode: "live" },
  { id: "glassWind.shellHighlightFollow", label: "高光跟随", group: "glassWind", type: "number", min: 0, max: 4, step: 0.01, default: 1.9, target: "glassWind.shellHighlightFollow", applyMode: "live" },
  { id: "glassWind.centerGlowFollow", label: "中心辉光跟随", group: "glassWind", type: "number", min: 0, max: 2, step: 0.01, default: 0.72, target: "glassWind.centerGlowFollow", applyMode: "live" },

  { id: "flowParticles.flowFanOpacity", label: "内部流线不透明度", group: "flowParticles", type: "number", min: 0, max: 2, step: 0.01, default: 0, target: "flowParticles.flowFanOpacity", applyMode: "live" },
  { id: "flowParticles.flowLineOpacity", label: "内部细线不透明度", group: "flowParticles", type: "number", min: 0, max: 2, step: 0.01, default: 0, target: "flowParticles.flowLineOpacity", applyMode: "live" },
  { id: "flowParticles.goldDustOpacity", label: "金尘不透明度", group: "flowParticles", type: "number", min: 0, max: 2, step: 0.01, default: 1.05, target: "flowParticles.goldDustOpacity", applyMode: "live" },
  { id: "flowParticles.goldDustSpeed", label: "金尘速度", group: "flowParticles", type: "number", min: 0, max: 3, step: 0.01, default: 1, target: "flowParticles.goldDustSpeed", applyMode: "live" },
  { id: "flowParticles.particleOpacity", label: "粒子不透明度", group: "flowParticles", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "flowParticles.particleOpacity", applyMode: "live" },
  { id: "flowParticles.particleSize", label: "粒子大小", group: "flowParticles", type: "number", min: 0.2, max: 3, step: 0.01, default: 1, target: "flowParticles.particleSize", applyMode: "live" },
  { id: "flowParticles.glowOpacity", label: "外辉光不透明度", group: "flowParticles", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "flowParticles.glowOpacity", applyMode: "live" },
  { id: "flowParticles.glowScale", label: "外辉光缩放", group: "flowParticles", type: "number", min: 0.2, max: 2.5, step: 0.01, default: 1, target: "flowParticles.glowScale", applyMode: "live" },
  { id: "flowParticles.keyLight", label: "主光强度", group: "flowParticles", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "flowParticles.keyLight", applyMode: "live" },
  { id: "flowParticles.cyanLight", label: "青色光强", group: "flowParticles", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "flowParticles.cyanLight", applyMode: "live" },
  { id: "flowParticles.roseLight", label: "玫瑰光强", group: "flowParticles", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "flowParticles.roseLight", applyMode: "live" },

  { id: "audio.masterMin", label: "主输出下限", group: "audio", type: "number", min: 0, max: 0.8, step: 0.01, default: 0.26, target: "audio.masterMin", applyMode: "live" },
  { id: "audio.masterMax", label: "主输出上限", group: "audio", type: "number", min: 0, max: 0.9, step: 0.01, default: 0.36, target: "audio.masterMax", applyMode: "live" },
  { id: "audio.calmFallbackGain", label: "平静合成增益", group: "audio", type: "number", min: 0, max: 0.2, step: 0.001, default: 0.08, target: "audio.calmFallbackGain", applyMode: "live" },
  { id: "audio.droneFallbackGain", label: "低频合成增益", group: "audio", type: "number", min: 0, max: 0.2, step: 0.001, default: 0.066, target: "audio.droneFallbackGain", applyMode: "live" },
  { id: "audio.noiseFallbackGain", label: "噪声合成增益", group: "audio", type: "number", min: 0, max: 0.2, step: 0.001, default: 0.08, target: "audio.noiseFallbackGain", applyMode: "live" },
  { id: "audio.tremoloMinHz", label: "颤音最低频率", group: "audio", type: "number", min: 0.1, max: 8, step: 0.1, default: 0.8, target: "audio.tremoloMinHz", applyMode: "live" },
  { id: "audio.tremoloMaxHz", label: "颤音最高频率", group: "audio", type: "number", min: 1, max: 18, step: 0.1, default: 8.2, target: "audio.tremoloMaxHz", applyMode: "live" },
  { id: "audio.tremoloGainHigh", label: "高压颤音增益", group: "audio", type: "number", min: 0, max: 0.12, step: 0.001, default: 0.018, target: "audio.tremoloGainHigh", applyMode: "live" },
  { id: "audio.clickThreshold", label: "点击音阈值", group: "audio", type: "number", min: 0, max: 1, step: 0.01, default: 0.36, target: "audio.clickThreshold", applyMode: "live" },
  { id: "audio.clickGainMin", label: "点击音最小增益", group: "audio", type: "number", min: 0, max: 0.04, step: 0.0005, default: 0.0012, target: "audio.clickGainMin", applyMode: "live" },
  { id: "audio.clickGainMax", label: "点击音最大增益", group: "audio", type: "number", min: 0, max: 0.08, step: 0.0005, default: 0.006, target: "audio.clickGainMax", applyMode: "live" },
  { id: "audio.clickFreqMin", label: "点击音最低频率", group: "audio", type: "number", min: 20, max: 400, step: 1, default: 82, target: "audio.clickFreqMin", applyMode: "live" },
  { id: "audio.clickFreqMax", label: "点击音最高频率", group: "audio", type: "number", min: 40, max: 800, step: 1, default: 240, target: "audio.clickFreqMax", applyMode: "live" },
  { id: "audio.calmPadGain", label: "平静铺底音轨增益", group: "audio", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "audio.stemGain.calmPad", applyMode: "live" },
  { id: "audio.contemplationGain", label: "沉思音轨增益", group: "audio", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "audio.stemGain.contemplation", applyMode: "live" },
  { id: "audio.airBellsGain", label: "空气铃音轨增益", group: "audio", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "audio.stemGain.airBells", applyMode: "live" },
  { id: "audio.pressureCavernGain", label: "压力洞穴音轨增益", group: "audio", type: "number", min: 0, max: 2, step: 0.01, default: 1, target: "audio.stemGain.pressureCavern", applyMode: "live" },
  { id: "audio.stemFilterScale", label: "音轨滤波比例", group: "audio", type: "number", min: 0.2, max: 2.5, step: 0.01, default: 1, target: "audio.stemFilterScale", applyMode: "live" },
  { id: "audio.stemRateScale", label: "音轨速率比例", group: "audio", type: "number", min: 0.5, max: 1.5, step: 0.001, default: 1, target: "audio.stemRateScale", applyMode: "live" },

  { id: "voice.browserRate", label: "浏览器语音语速", group: "voiceEvents", type: "number", min: 0.3, max: 1.3, step: 0.01, default: 0.7, target: "voice.browserRate", applyMode: "live" },
  { id: "voice.overloadRate", label: "过载语音语速", group: "voiceEvents", type: "number", min: 0.3, max: 1.3, step: 0.01, default: 0.78, target: "voice.overloadRate", applyMode: "live" },
  { id: "voice.browserPitch", label: "浏览器语音音高", group: "voiceEvents", type: "number", min: 0.3, max: 1.5, step: 0.01, default: 0.88, target: "voice.browserPitch", applyMode: "live" },
  { id: "voice.overloadPitch", label: "过载语音音高", group: "voiceEvents", type: "number", min: 0.3, max: 1.5, step: 0.01, default: 0.82, target: "voice.overloadPitch", applyMode: "live" },
  { id: "voice.browserVolume", label: "浏览器语音音量", group: "voiceEvents", type: "number", min: 0, max: 1, step: 0.01, default: 0.58, target: "voice.browserVolume", applyMode: "live" },
  { id: "voice.previewVolume", label: "预听语音音量", group: "voiceEvents", type: "number", min: 0, max: 1, step: 0.01, default: 0.62, target: "voice.previewVolume", applyMode: "live" },
  { id: "voice.overloadPreviewVolume", label: "过载预听音量", group: "voiceEvents", type: "number", min: 0, max: 1, step: 0.01, default: 0.68, target: "voice.overloadPreviewVolume", applyMode: "live" },
  { id: "voice.cueDelayMinMs", label: "语音提示最小延迟", group: "voiceEvents", type: "number", min: 0, max: 5000, step: 50, default: 1200, target: "voice.cueDelayMinMs", applyMode: "live" },
  { id: "voice.cueDelayMaxMs", label: "语音提示最大延迟", group: "voiceEvents", type: "number", min: 0, max: 8000, step: 50, default: 3600, target: "voice.cueDelayMaxMs", applyMode: "live" },

  { id: "metrics.mockBreathRateMin", label: "模拟呼吸率下限", group: "metricsReplay", type: "number", min: 3, max: 24, step: 0.1, default: 8.8, target: "metrics.mockBreathRateMin", applyMode: "live" },
  { id: "metrics.mockBreathRateMax", label: "模拟呼吸率上限", group: "metricsReplay", type: "number", min: 4, max: 42, step: 0.1, default: 18.4, target: "metrics.mockBreathRateMax", applyMode: "live" },
  { id: "metrics.mockHeartRateMin", label: "模拟心率下限", group: "metricsReplay", type: "number", min: 35, max: 120, step: 1, default: 62, target: "metrics.mockHeartRateMin", applyMode: "live" },
  { id: "metrics.mockHeartRateMax", label: "模拟心率上限", group: "metricsReplay", type: "number", min: 50, max: 180, step: 1, default: 108, target: "metrics.mockHeartRateMax", applyMode: "live" },
  { id: "metrics.mockStabilityMin", label: "模拟稳定度下限", group: "metricsReplay", type: "number", min: 0, max: 1, step: 0.01, default: 0.24, target: "metrics.mockStabilityMin", applyMode: "live" },
  { id: "metrics.mockStabilityMax", label: "模拟稳定度上限", group: "metricsReplay", type: "number", min: 0, max: 1, step: 0.01, default: 0.9, target: "metrics.mockStabilityMax", applyMode: "live" },
  { id: "replay.url", label: "回放数据地址", group: "metricsReplay", type: "text", default: "./data/replay/demo_replay.json", target: "replay.url", applyMode: "manual" },
];

export function getControlValue(config, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], config);
}

export function setControlValue(config, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((cursor, key) => {
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    return cursor[key];
  }, config);
  target[last] = value;
}

export function controlsForGroup(groupId) {
  return CONTROL_PARAMS.filter((param) => param.group === groupId);
}

export function createTimelineStages() {
  return STAGES.map((stage) => ({
    name: stage.name,
    label: STAGE_LABELS[stage.name] || stage.name,
    duration: stage.duration,
    pressure: [...stage.pressure],
    pulse: [...stage.pulse],
    jitter: [...stage.jitter],
    drift: [...stage.drift],
    brightness: [...stage.brightness],
    edge: [...stage.edge],
  }));
}

export function createTimelineEvents(stages = createTimelineStages()) {
  let cursor = 0;
  const events = [];
  stages.forEach((stage) => {
    const offsets = CUE_OFFSETS[stage.name] || [];
    offsets.forEach((offset, index) => {
      events.push({
        id: `voice-${stage.name}-${index}`,
        timeMs: Math.round(cursor + stage.duration * offset),
        event: "voice.triggerStageCue",
        payload: { stage: stage.name },
        enabled: true,
      });
    });
    cursor += stage.duration;
  });
  return events;
}

export function createRuntimeConfig() {
  const config = {
    timeline: {
      stages: createTimelineStages(),
      parameterKeyframes: [],
      eventKeyframes: [],
    },
  };
  CONTROL_PARAMS.forEach((param) => {
    setControlValue(config, param.target, param.default);
  });
  config.timeline.eventKeyframes = createTimelineEvents(config.timeline.stages);
  return config;
}

export function resetControlGroup(config, groupId) {
  controlsForGroup(groupId).forEach((param) => {
    setControlValue(config, param.target, param.default);
  });
}
