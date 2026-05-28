export const EVENT_REGISTRY = [
  { type: "timeline.play", label: "播放时间线", group: "时间线" },
  { type: "timeline.pause", label: "暂停时间线", group: "时间线" },
  { type: "timeline.reset", label: "重置时间线", group: "时间线" },
  { type: "timeline.seek", label: "跳转时间", group: "时间线", defaultPayload: { elapsedMs: 0 } },
  { type: "timeline.setStage", label: "设置阶段", group: "时间线", defaultPayload: { stage: "calm" } },
  { type: "visual.setParam", label: "设置视觉参数", group: "视觉", defaultPayload: { id: "windYawAmount", target: "glassWind.windYawAmount", value: 1.15, group: "glassWind" } },
  { type: "visual.resetGroup", label: "重置当前参数组", group: "视觉" },
  { type: "audio.init", label: "初始化音频", group: "音频" },
  { type: "audio.stop", label: "停止音频", group: "音频" },
  { type: "audio.triggerClick", label: "触发点击音", group: "音频" },
  { type: "audio.setPressure", label: "设置压力", group: "音频", defaultPayload: { pressure: 0.5 } },
  { type: "voice.triggerStageCue", label: "触发阶段语音", group: "语音" },
  { type: "voice.stop", label: "停止语音", group: "语音" },
  { type: "replay.reload", label: "重新加载回放", group: "回放" },
  { type: "log.export", label: "导出日志", group: "日志" },
  { type: "view.toggleLive", label: "切换现场视图", group: "视图" },
];

export function createEventBus({ maxLog = 160 } = {}) {
  const listeners = new Map();
  const log = [];

  function on(type, handler) {
    const handlers = listeners.get(type) || new Set();
    handlers.add(handler);
    listeners.set(type, handlers);
    return () => handlers.delete(handler);
  }

  function dispatch(type, payload = {}, meta = {}) {
    const event = {
      type,
      payload,
      meta,
      timestamp: new Date().toISOString(),
    };
    log.unshift(event);
    log.splice(maxLog);
    (listeners.get(type) || []).forEach((handler) => handler(event));
    (listeners.get("*") || []).forEach((handler) => handler(event));
    return event;
  }

  function clearLog() {
    log.splice(0);
  }

  return {
    on,
    dispatch,
    clearLog,
    get log() {
      return log;
    },
  };
}
