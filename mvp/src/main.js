import {
  DEFAULT_REPLAY_URL,
  STAGE_LABELS,
  STAGE_ORDER,
  stageLabel,
  totalDuration,
} from "./config/stages.js";
import {
  CONTROL_GROUPS,
  CONTROL_PARAMS,
  controlsForGroup,
  createRuntimeConfig,
  createTimelineEvents,
  getControlValue,
  resetControlGroup,
  setControlValue,
} from "./config/controlSchema.js";
import { EVENT_REGISTRY, createEventBus } from "./events/eventBus.js";
import { createTimelineEngine, metricsFromTimeline } from "./timeline/timelineEngine.js";
import { clamp } from "./utils/math.js";
import { createAudioEngine } from "./audio/audioEngine.js";
import { createLogExporter } from "./logging/exportLog.js";
import { createVoiceClient } from "./voice/voiceClient.js";
import { disposeLogo3d, initLogo3d, resizeLogo3d, updateLogo3d } from "./visual/logoScene.js";

const els = {
  body: document.body,
  siriScene: document.getElementById("siriScene"),
  siriCanvas: document.getElementById("siriCanvas"),
  panelTabs: document.getElementById("panelTabs"),
  panelRoot: document.getElementById("panelRoot"),
  readoutRoot: document.getElementById("readoutRoot"),
  phaseStrip: document.getElementById("phaseStrip"),
  startBtn: document.getElementById("startBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  stopAudioBtn: document.getElementById("stopAudioBtn"),
  liveModeBtn: document.getElementById("liveModeBtn"),
  liveReturnBtn: document.getElementById("liveReturnBtn"),
  voicePreview: document.getElementById("voicePreview"),
};

function pageCanRunVisuals() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("forceVisuals") === "1") return true;
  return (
    document.visibilityState === "visible" &&
    !document.hidden &&
    window.innerWidth > 0 &&
    window.innerHeight > 0
  );
}

function publishVisualInitError(error) {
  window.__soapFilmDebug = {
    ...(window.__soapFilmDebug || {}),
    ready: false,
    debugView: "init-error",
    lastError: {
      name: error?.name || "Error",
      message: error?.message || String(error),
      stack: error?.stack || "",
    },
    updatedAtMs: Math.round(performance.now()),
  };
  document.documentElement.dataset.soapFilmDebug = JSON.stringify(window.__soapFilmDebug);
}

function safeInitLogo3d() {
  try {
    initLogo3d(els);
  } catch (error) {
    publishVisualInitError(error);
    console.error("Logo 3D initialization failed", error);
  }
}

const state = {
  activePanel: "run",
  mode: "timeline",
  running: false,
  startTime: 0,
  pauseStartedAt: 0,
  pausedMs: 0,
  elapsedMs: 0,
  speed: 1,
  currentStage: "calm",
  pressure: 0,
  dataSource: "replay",
  currentMetrics: null,
  replay: {
    url: DEFAULT_REPLAY_URL,
    loaded: false,
    loading: false,
    status: "等待加载",
    error: null,
    meta: null,
    frames: [],
    times: [],
    durationMs: totalDuration(),
  },
  runtimeConfig: createRuntimeConfig(),
  visual: {
    pulseRate: 0.24,
    pulseAmplitude: 0.18,
    brightness: 0.5,
    edgeSharpness: 0.1,
    jitter: 0,
    drift: 0,
  },
  stateLogs: [],
  voiceLogs: [],
  pendingVoiceRequests: 0,
  lastVoiceText: "等待生成",
  lastTtsStatus: "本地 TTS 待机",
  lastStateLogAt: 0,
  audioTestActive: false,
  liveMode: false,
  lastRenderAt: 0,
  lastReadoutAt: 0,
  rafId: 0,
  pageVisible: pageCanRunVisuals(),
  resumeAfterVisibility: false,
};

const timelineEngine = createTimelineEngine();
const eventBus = createEventBus();

function applyInitialUrlOverrides() {
  const params = new URLSearchParams(window.location.search);
  CONTROL_PARAMS.forEach((param) => {
    const shortId = param.id.split(".").pop();
    const rawValue = params.get(param.id) ?? params.get(shortId);
    if (rawValue === null) return;
    if (param.type === "select" && param.options?.length && !param.options.some((option) => option.value === rawValue)) return;
    setControlValue(state.runtimeConfig, param.target, parseControlValue(param, rawValue));
  });

  const view = params.get("view");
  if (view && CONTROL_PARAMS.find((param) => param.id === "visual.cameraView")?.options?.some((option) => option.value === view)) {
    setControlValue(state.runtimeConfig, "visual.cameraView", view);
  }

  if (params.get("live") === "1") {
    state.liveMode = true;
    els.body.classList.add("live");
  }
}

const {
  initAudio,
  setAudioAudible,
  stopAllAudio,
  setAudioPressure,
  triggerClick,
  currentAudioParams,
} = createAudioEngine({ state, els, updateReadout });

const {
  pickFallbackCue,
  requestVoiceCue,
  stopVoice,
} = createVoiceClient({
  state,
  els,
  currentAudioParams,
  roundedMetrics,
  updateReadout,
});

const exportLog = createLogExporter({ state, replaySourceLabel });

const PARAMETER_KEYFRAME_OPTIONS = [
  { value: "pressure", label: "压力" },
  { value: "visual.pulseRate", label: "视觉：脉冲频率" },
  { value: "visual.pulseAmplitude", label: "视觉：脉冲幅度" },
  { value: "visual.brightness", label: "视觉：亮度" },
  { value: "visual.edgeSharpness", label: "视觉：边缘锐度" },
  { value: "visual.jitter", label: "视觉：抖动" },
  { value: "visual.drift", label: "视觉：漂移" },
];

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function eventLabel(type) {
  return EVENT_REGISTRY.find((eventDef) => eventDef.type === type)?.label || type;
}

function parameterPathLabel(path) {
  return PARAMETER_KEYFRAME_OPTIONS.find((option) => option.value === path)?.label || path;
}

function payloadLabel(payload = {}) {
  if (payload.stage) return `阶段：${stageLabel(payload.stage)}`;
  if (payload.elapsedMs !== undefined) return `时间：${formatTime(Number(payload.elapsedMs) || 0)}`;
  if (payload.pressure !== undefined) return `压力：${payload.pressure}`;
  if (payload.target && payload.value !== undefined) {
    return `${findControlParam(payload)?.label || payload.target} = ${payload.value}`;
  }
  const serialized = JSON.stringify(payload || {});
  return serialized === "{}" ? "无参数" : serialized;
}

function replayTypeLabel(sourceType) {
  if (sourceType === "synthetic") return "合成回放";
  if (sourceType === "replay") return "回放";
  return sourceType || "回放";
}

function roundedMetrics(metrics) {
  if (!metrics) return null;
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [
      key,
      Number(Number(value || 0).toFixed(key === "heartRateBpm" || key === "breathRate" ? 2 : 4)),
    ]),
  );
}

function replaySourceLabel() {
  if (state.dataSource !== "replay") return "模拟时间线";
  if (state.replay.error) return `回放失败：${state.replay.error}`;
  if (!state.replay.loaded) return state.replay.status;
  const sourceType = replayTypeLabel(state.replay.meta?.sourceType || "replay");
  return `${sourceType} / ${state.replay.frames.length} 帧`;
}

function metricFromFrame(frame, key, fallback) {
  const value = Number(frame?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

async function loadReplayData({ force = false } = {}) {
  if (state.replay.loading || (state.replay.loaded && !force)) return;
  state.replay.loading = true;
  state.replay.error = null;
  state.replay.status = "加载中";
  state.replay.url = state.runtimeConfig.replay.url || DEFAULT_REPLAY_URL;
  updateReadout();

  try {
    const response = await fetch(state.replay.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status}`);
    const payload = await response.json();
    const frames = Array.isArray(payload.frames) ? payload.frames : [];
    if (!frames.length) throw new Error("数据帧为空");
    const normalizedFrames = frames
      .map((frame) => ({
        ...frame,
        time: metricFromFrame(frame, "time", 0),
        stageHint: STAGE_ORDER.includes(frame.stageHint) ? frame.stageHint : "calm",
      }))
      .sort((a, b) => a.time - b.time);
    state.replay.frames = normalizedFrames;
    state.replay.times = normalizedFrames.map((frame) => frame.time * 1000);
    state.replay.durationMs = state.replay.times[state.replay.times.length - 1] || timelineEngine.duration(state.runtimeConfig);
    state.replay.meta = payload.meta || {};
    state.replay.loaded = true;
    state.replay.status = replaySourceLabel();
  } catch (error) {
    state.replay.error = error.message;
    state.replay.status = replaySourceLabel();
    console.warn("回放数据不可用，已切换到模拟时间线。", error);
  } finally {
    state.replay.loading = false;
    updateReadout();
  }
}

function parseControlValue(param, rawValue) {
  if (param.type === "checkbox") return Boolean(rawValue);
  if (param.type === "select") return String(rawValue);
  if (param.type === "text") return String(rawValue);
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : param.default;
}

function findControlParam(payload = {}) {
  return CONTROL_PARAMS.find((param) => (
    param.id === payload.id ||
    param.id === payload.target ||
    param.target === payload.target ||
    param.id.split(".").pop() === payload.id
  ));
}

function setRuntimeControl(param, rawValue) {
  const value = parseControlValue(param, rawValue);
  setControlValue(state.runtimeConfig, param.target, value);
  if (["visual", "glassWind", "flowParticles"].includes(param.group)) {
    state.mode = "manual-preview";
    state.running = false;
    setAudioAudible(false);
        els.playPauseBtn.textContent = "开始";
  }
  if (param.group === "audio") {
    setAudioPressure(state.pressure, state.currentMetrics, state.runtimeConfig.audio);
  }
  return value;
}

function applyControl(param, value) {
  const parsed = setRuntimeControl(param, value);
  eventBus.dispatch("visual.setParam", { id: param.id, target: param.target, value: parsed, group: param.group }, { source: "control" });
}

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, eventType, payload = {}, className = "") {
  const node = h("button", className, label);
  node.type = "button";
  node.dataset.eventType = eventType;
  node.addEventListener("click", () => eventBus.dispatch(eventType, payload, { source: "ui" }));
  return node;
}

function setActivePanel(panelId) {
  state.activePanel = panelId;
  [...els.panelTabs.querySelectorAll(".tab")].forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === panelId);
  });
  renderPanel();
}

function renderTabs() {
  els.panelTabs.replaceChildren();
  CONTROL_GROUPS.forEach((group) => {
    const tab = h("button", "tab", group.label);
    tab.type = "button";
    tab.dataset.panel = group.id;
    tab.classList.toggle("active", group.id === state.activePanel);
    tab.addEventListener("click", () => setActivePanel(group.id));
    els.panelTabs.append(tab);
  });
}

function renderParamControls(groupId) {
  const root = h("div", "control-grid");
  controlsForGroup(groupId).forEach((param) => {
    const value = getControlValue(state.runtimeConfig, param.target);
    const row = h("label", "control-field");
    row.dataset.controlId = param.id.split(".").pop();
    row.dataset.controlFullId = param.id;
    row.dataset.controlGroup = param.group;
    row.dataset.controlTarget = param.target;
    const head = h("span", "control-label", param.label);
    const valueText = h("strong", "control-value", String(value));
    const actions = h("div", "control-actions");

    if (param.type === "text") {
      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.addEventListener("change", () => {
        applyControl(param, parseControlValue(param, input.value));
        valueText.textContent = input.value;
      });
      actions.append(input);
    } else if (param.type === "select") {
      const select = document.createElement("select");
      (param.options || []).forEach((option) => {
        const item = document.createElement("option");
        item.value = option.value;
        item.textContent = option.label;
        select.append(item);
      });
      select.value = value;
      valueText.textContent = param.options?.find((option) => option.value === value)?.label || String(value);
      select.addEventListener("change", () => {
        const parsed = parseControlValue(param, select.value);
        applyControl(param, parsed);
        valueText.textContent = param.options?.find((option) => option.value === parsed)?.label || parsed;
      });
      actions.append(select);
    } else {
      const range = document.createElement("input");
      range.type = "range";
      range.min = param.min;
      range.max = param.max;
      range.step = param.step;
      range.value = value;
      const number = document.createElement("input");
      number.type = "number";
      number.min = param.min;
      number.max = param.max;
      number.step = param.step;
      number.value = value;
      const sync = (nextValue) => {
        const parsed = parseControlValue(param, nextValue);
        range.value = parsed;
        number.value = parsed;
        valueText.textContent = String(parsed);
        applyControl(param, parsed);
      };
      range.addEventListener("input", () => sync(range.value));
      number.addEventListener("change", () => sync(number.value));
      actions.append(range, number);
    }

    const reset = h("button", "icon-button", "复位");
    reset.type = "button";
    reset.addEventListener("click", () => {
      applyControl(param, param.default);
      renderPanel();
    });
    row.append(head, valueText, actions, reset);
    root.append(row);
  });
  return root;
}

function renderRunPanel(root) {
  const controls = h("div", "button-row");
  controls.append(
    button("播放", "timeline.play", {}, "primary"),
    button("暂停", "timeline.pause"),
    button("重置", "timeline.reset"),
    button("停止音频", "audio.stop", {}, "danger"),
    button("现场视图", "view.toggleLive"),
  );

  const dataRow = h("div", "inline-grid");
  const dataLabel = h("label", "select-field", "数据源");
  const dataSource = document.createElement("select");
  [["replay", "回放"], ["mock", "模拟"]].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === state.dataSource;
    dataSource.append(option);
  });
  dataSource.addEventListener("change", () => {
    state.dataSource = dataSource.value;
    if (state.dataSource === "replay") loadReplayData({ force: true });
    updateReadout();
  });
  dataLabel.append(dataSource);

  const speedLabel = h("label", "select-field", "速度");
  const speed = document.createElement("select");
  [0.25, 0.5, 1, 2, 4].forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = `${value} 倍`;
    option.selected = value === state.speed;
    speed.append(option);
  });
  speed.addEventListener("change", () => {
    state.speed = Number(speed.value);
  });
  speedLabel.append(speed);

  const seekLabel = h("label", "select-field", "跳转秒数");
  const seekInput = document.createElement("input");
  seekInput.type = "number";
  seekInput.min = "0";
  seekInput.step = "1";
  seekInput.value = "0";
  const seekButton = h("button", "", "跳转");
  seekButton.type = "button";
  seekButton.addEventListener("click", () => eventBus.dispatch("timeline.seek", { elapsedMs: Number(seekInput.value) * 1000 }, { source: "ui" }));
  seekLabel.append(seekInput, seekButton);

  dataRow.append(dataLabel, speedLabel, seekLabel);
  root.append(controls, dataRow);
}

function stageStartMs(stageName) {
  let cursor = 0;
  for (const stage of state.runtimeConfig.timeline.stages) {
    if (stage.name === stageName) return cursor;
    cursor += stage.duration;
  }
  return 0;
}

function renderTimelinePanel(root) {
  const stagesTitle = h("h2", "", "阶段曲线");
  const stageGrid = h("div", "stage-editor");
  state.runtimeConfig.timeline.stages.forEach((stage, index) => {
    const card = h("div", "editor-card");
    card.append(h("h3", "", STAGE_LABELS[stage.name] || stage.name));
    const fields = [
      ["时长（秒）", "duration", 1000],
      ["压力起点", "pressure.0", 1],
      ["压力终点", "pressure.1", 1],
      ["脉冲起点", "pulse.0", 1],
      ["脉冲终点", "pulse.1", 1],
      ["抖动起点", "jitter.0", 1],
      ["抖动终点", "jitter.1", 1],
      ["漂移起点", "drift.0", 1],
      ["漂移终点", "drift.1", 1],
      ["亮度起点", "brightness.0", 1],
      ["亮度终点", "brightness.1", 1],
      ["边缘起点", "edge.0", 1],
      ["边缘终点", "edge.1", 1],
    ];
    fields.forEach(([label, path, divisor]) => {
      const wrapper = h("label", "mini-field", label);
      const input = document.createElement("input");
      input.type = "number";
      input.step = divisor === 1000 ? "1" : "0.01";
      const parts = path.split(".");
      const current = parts.length === 1 ? stage[parts[0]] : stage[parts[0]][Number(parts[1])];
      input.value = String(divisor === 1000 ? Math.round(current / divisor) : current);
      input.addEventListener("change", () => {
        const next = Number(input.value) * divisor;
        if (parts.length === 1) stage[parts[0]] = next;
        else stage[parts[0]][Number(parts[1])] = Number(input.value);
        state.runtimeConfig.timeline.stages[index] = stage;
        updateReadout();
      });
      wrapper.append(input);
      card.append(wrapper);
    });
    card.append(button("跳到此阶段", "timeline.setStage", { stage: stage.name }));
    stageGrid.append(card);
  });

  const rebuild = h("button", "", "按阶段重建语音事件");
  rebuild.type = "button";
  rebuild.addEventListener("click", () => {
    state.runtimeConfig.timeline.eventKeyframes = createTimelineEvents(state.runtimeConfig.timeline.stages);
    timelineEngine.resetEvents();
    renderPanel();
  });

  const keyframes = renderParameterKeyframes();
  const events = renderEventKeyframes();
  root.append(stagesTitle, stageGrid, rebuild, keyframes, events);
}

function renderParameterKeyframes() {
  const section = h("section", "editor-section");
  section.append(h("h2", "", "参数关键帧"));
  const list = h("div", "event-list");
  state.runtimeConfig.timeline.parameterKeyframes.forEach((keyframe, index) => {
    const row = h("div", "event-row");
    row.textContent = `${formatTime(keyframe.timeMs)}  ${parameterPathLabel(keyframe.path)} = ${keyframe.value}`;
    const del = h("button", "", "删除");
    del.type = "button";
    del.addEventListener("click", () => {
      state.runtimeConfig.timeline.parameterKeyframes.splice(index, 1);
      renderPanel();
    });
    row.append(del);
    list.append(row);
  });

  const form = h("div", "inline-grid");
  const time = document.createElement("input");
  time.type = "number";
  time.min = "0";
  time.step = "1";
  time.placeholder = "秒";
  const path = document.createElement("select");
  PARAMETER_KEYFRAME_OPTIONS.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    path.append(option);
  });
  const value = document.createElement("input");
  value.type = "number";
  value.step = "0.01";
  value.placeholder = "数值";
  const add = h("button", "", "添加关键帧");
  add.type = "button";
  add.addEventListener("click", () => {
    state.runtimeConfig.timeline.parameterKeyframes.push({
      id: `param-${Date.now()}`,
      timeMs: Number(time.value || 0) * 1000,
      path: path.value,
      value: Number(value.value || 0),
      interpolate: true,
      enabled: true,
    });
    renderPanel();
  });
  form.append(time, path, value, add);
  section.append(list, form);
  return section;
}

function renderEventKeyframes() {
  const section = h("section", "editor-section");
  section.append(h("h2", "", "事件关键帧"));
  const list = h("div", "event-list");
  state.runtimeConfig.timeline.eventKeyframes.forEach((keyframe, index) => {
    const row = h("div", "event-row");
    row.textContent = `${formatTime(keyframe.timeMs)}  ${eventLabel(keyframe.event)}  ${payloadLabel(keyframe.payload || {})}`;
    const toggle = h("button", "", keyframe.enabled === false ? "启用" : "禁用");
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      keyframe.enabled = keyframe.enabled === false;
      timelineEngine.resetEvents();
      renderPanel();
    });
    const del = h("button", "", "删除");
    del.type = "button";
    del.addEventListener("click", () => {
      state.runtimeConfig.timeline.eventKeyframes.splice(index, 1);
      timelineEngine.resetEvents();
      renderPanel();
    });
    row.append(toggle, del);
    list.append(row);
  });

  const form = h("div", "inline-grid");
  const time = document.createElement("input");
  time.type = "number";
  time.min = "0";
  time.step = "1";
  time.placeholder = "秒";
  const type = document.createElement("select");
  EVENT_REGISTRY.forEach((eventDef) => {
    const option = document.createElement("option");
    option.value = eventDef.type;
    option.textContent = eventDef.label;
    type.append(option);
  });
  const stage = document.createElement("select");
  STAGE_ORDER.forEach((stageName) => {
    const option = document.createElement("option");
    option.value = stageName;
    option.textContent = stageLabel(stageName);
    stage.append(option);
  });
  const add = h("button", "", "添加事件");
  add.type = "button";
  add.addEventListener("click", () => {
    const payload = type.value === "voice.triggerStageCue" || type.value === "timeline.setStage" ? { stage: stage.value } : {};
    state.runtimeConfig.timeline.eventKeyframes.push({
      id: `event-${Date.now()}`,
      timeMs: Number(time.value || 0) * 1000,
      event: type.value,
      payload,
      enabled: true,
    });
    timelineEngine.resetEvents();
    renderPanel();
  });
  form.append(time, type, stage, add);
  section.append(list, form);
  return section;
}

function renderEventsPanel(root) {
  root.append(renderParamControls("voiceEvents"));
  const eventSection = h("section", "editor-section");
  eventSection.append(h("h2", "", "手动事件"));
  const eventGrid = h("div", "event-button-grid");
  EVENT_REGISTRY.forEach((eventDef) => {
    eventGrid.append(button(eventDef.label, eventDef.type, eventDef.defaultPayload || {}));
  });
  STAGE_ORDER.forEach((stageName) => {
    eventGrid.append(button(`语音：${stageLabel(stageName)}`, "voice.triggerStageCue", { stage: stageName }, "primary"));
  });
  eventSection.append(eventGrid);
  root.append(eventSection);
}

function renderLogsPanel(root) {
  const actions = h("div", "button-row");
  actions.append(button("导出日志", "log.export", {}, "primary"));
  const clear = h("button", "", "清空事件记录");
  clear.type = "button";
  clear.addEventListener("click", () => {
    eventBus.clearLog();
    renderPanel();
    updateReadout();
  });
  actions.append(clear);
  const list = h("div", "log-list");
  eventBus.log.slice(0, 80).forEach((event) => {
    const row = h("div", "log-row");
    row.textContent = `${event.timestamp}  ${eventLabel(event.type)}  ${payloadLabel(event.payload || {})}`;
    list.append(row);
  });
  root.append(actions, list);
}

function renderPanel() {
  els.panelRoot.replaceChildren();
  const group = CONTROL_GROUPS.find((item) => item.id === state.activePanel);
  if (group) els.panelRoot.append(h("h2", "panel-title", group.label));
  if (state.activePanel === "run") renderRunPanel(els.panelRoot);
  else if (state.activePanel === "timeline") renderTimelinePanel(els.panelRoot);
  else if (state.activePanel === "voiceEvents") renderEventsPanel(els.panelRoot);
  else if (state.activePanel === "logs") renderLogsPanel(els.panelRoot);
  else {
    els.panelRoot.append(renderParamControls(state.activePanel));
    if (state.activePanel === "metricsReplay") {
      const reload = button("重新加载回放", "replay.reload", {}, "primary");
      const status = h("p", "hint", replaySourceLabel());
      els.panelRoot.append(reload, status);
    }
  }
}

function updateReadout() {
  state.lastReadoutAt = performance.now();
  els.readoutRoot.replaceChildren();
  [
    ["阶段", stageLabel(state.currentStage)],
    ["时间", formatTime(state.elapsedMs)],
    ["压力", state.pressure.toFixed(2)],
    ["数据源", replaySourceLabel()],
    ["事件", String(eventBus.log.length)],
    ["记录", String(state.stateLogs.length + state.voiceLogs.length)],
  ].forEach(([label, value]) => {
    const card = h("div", "readout-card");
    card.append(h("span", "", label), h("strong", "", value));
    els.readoutRoot.append(card);
  });

  els.phaseStrip.replaceChildren();
  state.runtimeConfig.timeline.stages.forEach((stage) => {
    const step = h("button", "phase-step", STAGE_LABELS[stage.name] || stage.name);
    step.type = "button";
    step.classList.toggle("active", stage.name === state.currentStage);
    step.addEventListener("click", () => eventBus.dispatch("timeline.setStage", { stage: stage.name }, { source: "phase-strip" }));
    els.phaseStrip.append(step);
  });

  els.playPauseBtn.textContent = state.running ? "暂停" : "开始";
  els.startBtn.textContent = state.running ? "重新开始" : "开始演出";
  els.liveModeBtn.textContent = state.liveMode ? "显示控制台" : "现场视图";
}

function applyVisual(visual, timeMs = performance.now()) {
  const config = state.runtimeConfig.visual;
  const pulse = 0.5 + 0.5 * Math.sin((timeMs / 1000) * Math.PI * 2 * visual.pulseRate);
  const pulseScale = 1 + pulse * visual.pulseAmplitude;
  const jitterWaveX = Math.sin(timeMs * 0.045) * visual.jitter * config.jitterXAmount;
  const jitterWaveY = Math.cos(timeMs * 0.037) * visual.jitter * config.jitterYAmount;
  const driftX = Math.sin(timeMs * 0.0008) * visual.drift * config.driftXAmount;
  const driftY = Math.cos(timeMs * 0.00065) * visual.drift * config.driftYAmount;

  document.documentElement.style.setProperty("--pulse-scale", pulseScale.toFixed(4));
  document.documentElement.style.setProperty("--orb-brightness", visual.brightness.toFixed(4));
  document.documentElement.style.setProperty("--edge-sharpness", visual.edgeSharpness.toFixed(4));
  document.documentElement.style.setProperty("--jitter-x", `${jitterWaveX.toFixed(2)}px`);
  document.documentElement.style.setProperty("--jitter-y", `${jitterWaveY.toFixed(2)}px`);
  document.documentElement.style.setProperty("--drift-x", `${driftX.toFixed(2)}px`);
  document.documentElement.style.setProperty("--drift-y", `${driftY.toFixed(2)}px`);
  document.documentElement.style.setProperty("--css-pulse-base", config.cssPulseScaleBase.toFixed(4));
  document.documentElement.style.setProperty("--css-pulse-amount", config.cssPulseScaleAmount.toFixed(4));
  document.documentElement.style.setProperty("--css-saturation-base", config.cssSaturationBase.toFixed(4));
  document.documentElement.style.setProperty("--css-saturation-edge", config.cssSaturationEdge.toFixed(4));
  document.documentElement.style.setProperty("--css-brightness-base", config.cssBrightnessBase.toFixed(4));
  document.documentElement.style.setProperty("--css-brightness-amount", config.cssBrightnessAmount.toFixed(4));
  updateLogo3d(visual, timeMs, state.pressure, state.runtimeConfig, state.currentStage);
}

function logState(nowMs) {
  if (nowMs - state.lastStateLogAt < 200) return;
  state.lastStateLogAt = nowMs;
  state.stateLogs.push({
    timestamp: new Date().toISOString(),
    elapsedMs: Math.round(state.elapsedMs),
    stage: state.currentStage,
    dataSource: state.dataSource,
    replaySource: state.replay.meta?.sourceType || null,
    pressure: Number(state.pressure.toFixed(4)),
    physiologicalMetrics: roundedMetrics(state.currentMetrics),
    visual: {
      pulseRate: Number(state.visual.pulseRate.toFixed(4)),
      brightness: Number(state.visual.brightness.toFixed(4)),
      jitter: Number(state.visual.jitter.toFixed(4)),
      drift: Number(state.visual.drift.toFixed(4)),
      edgeSharpness: Number(state.visual.edgeSharpness.toFixed(4)),
    },
    audio: currentAudioParams(),
    eventCount: eventBus.log.length,
  });
}

function setElapsedMs(elapsedMs) {
  state.elapsedMs = clamp(elapsedMs, 0, Math.max(timelineEngine.duration(state.runtimeConfig), state.replay.durationMs || 0));
  state.startTime = performance.now() - state.elapsedMs / Math.max(0.01, state.speed);
  state.pausedMs = 0;
}

function startTimeline({ restart = false } = {}) {
  initAudio();
  state.mode = "timeline";
  state.activePanel = "run";
  state.running = true;
  state.speed = Number(state.speed || 1);
  if (restart || !state.startTime) {
    state.elapsedMs = 0;
    state.startTime = performance.now();
    state.pausedMs = 0;
    state.stateLogs = [];
    state.voiceLogs = [];
    eventBus.clearLog();
    timelineEngine.resetEvents();
  } else if (state.pauseStartedAt) {
    state.pausedMs += performance.now() - state.pauseStartedAt;
  }
  state.pauseStartedAt = 0;
  setAudioAudible(true);
  loadReplayData();
  renderTabs();
  renderPanel();
  updateReadout();
}

function pauseTimeline() {
  state.running = false;
  state.pauseStartedAt = performance.now();
  setAudioAudible(false);
  updateReadout();
}

function resetTimeline() {
  state.running = false;
  state.mode = "timeline";
  state.elapsedMs = 0;
  state.startTime = 0;
  state.pauseStartedAt = 0;
  state.pausedMs = 0;
  state.currentStage = "calm";
  state.pressure = 0;
  state.currentMetrics = null;
  state.stateLogs = [];
  state.voiceLogs = [];
  state.lastVoiceText = "等待生成";
  state.lastTtsStatus = "本地 TTS 待机";
  eventBus.clearLog();
  timelineEngine.resetEvents();
  setAudioAudible(false);
  stopVoice();
  updateReadout();
  renderPanel();
}

function toggleLiveMode() {
  state.liveMode = !state.liveMode;
  els.body.classList.toggle("live", state.liveMode);
  updateReadout();
}

function bindEventHandlers() {
  eventBus.on("timeline.play", () => startTimeline({ restart: !state.running && state.elapsedMs === 0 }));
  eventBus.on("timeline.pause", pauseTimeline);
  eventBus.on("timeline.reset", resetTimeline);
  eventBus.on("timeline.seek", ({ payload }) => {
    setElapsedMs(Number(payload.elapsedMs || 0));
    timelineEngine.resetEvents();
    updateReadout();
  });
  eventBus.on("timeline.setStage", ({ payload }) => {
    setElapsedMs(stageStartMs(payload.stage || "calm"));
    state.currentStage = payload.stage || state.currentStage;
    timelineEngine.resetEvents();
    updateReadout();
  });
  eventBus.on("visual.setParam", ({ payload, meta }) => {
    if (meta?.source === "control") return;
    const param = findControlParam(payload);
    if (!param || payload.value === undefined) return;
    setRuntimeControl(param, payload.value);
    renderPanel();
  });
  eventBus.on("visual.resetGroup", ({ payload }) => {
    resetControlGroup(state.runtimeConfig, payload.group || state.activePanel);
    renderPanel();
  });
  eventBus.on("audio.init", () => {
    initAudio();
    setAudioAudible(true);
  });
  eventBus.on("audio.stop", () => stopAllAudio({ closeContext: true }));
  eventBus.on("audio.triggerClick", () => {
    initAudio();
    setAudioAudible(true);
    triggerClick(Math.max(state.pressure, 0.75), performance.now(), state.currentMetrics, state.runtimeConfig.audio);
  });
  eventBus.on("audio.setPressure", ({ payload }) => {
    state.pressure = clamp(Number(payload.pressure ?? 0.5), 0, 1);
    state.currentMetrics = metricsFromTimeline({ pressure: state.pressure }, state.elapsedMs, state.runtimeConfig);
    initAudio();
    setAudioAudible(true);
    setAudioPressure(state.pressure, state.currentMetrics, state.runtimeConfig.audio);
  });
  eventBus.on("voice.triggerStageCue", ({ payload }) => {
    const stage = payload.stage || state.currentStage || "calm";
    state.currentStage = stage;
    requestVoiceCue(stage, pickFallbackCue(stage));
  });
  eventBus.on("voice.stop", stopVoice);
  eventBus.on("replay.reload", () => {
    state.replay.loaded = false;
    loadReplayData({ force: true });
  });
  eventBus.on("log.export", exportLog);
  eventBus.on("view.toggleLive", toggleLiveMode);
  eventBus.on("*", () => {
    updateReadout();
    if (state.activePanel === "logs") renderPanel();
  });
}

function scheduleRenderLoop() {
  if (state.rafId || !state.pageVisible || !pageCanRunVisuals()) return;
  state.rafId = requestAnimationFrame(tick);
}

function cancelRenderLoop() {
  if (!state.rafId) return;
  cancelAnimationFrame(state.rafId);
  state.rafId = 0;
}

function suspendPageWork({ closeAudio = false } = {}) {
  state.pageVisible = false;
  state.resumeAfterVisibility = state.resumeAfterVisibility || state.running;
  cancelRenderLoop();
  disposeLogo3d();
  if (state.running) {
    pauseTimeline();
  } else {
    setAudioAudible(false);
  }
  stopVoice();
  if (closeAudio) stopAllAudio({ closeContext: true });
}

function resumePageWork() {
  if (!pageCanRunVisuals()) {
    suspendPageWork();
    return;
  }
  if (state.pageVisible) return;
  state.pageVisible = true;
  state.lastRenderAt = 0;
  state.lastReadoutAt = 0;
  safeInitLogo3d();
  resizeLogo3d();
  applyVisual(state.visual);
  updateReadout();
  scheduleRenderLoop();
  if (state.resumeAfterVisibility) {
    state.resumeAfterVisibility = false;
    eventBus.dispatch("timeline.play", {}, { source: "visibility" });
  }
}

function refreshPageActivity() {
  if (pageCanRunVisuals()) resumePageWork();
  else suspendPageWork();
}

function tick(nowMs) {
  state.rafId = 0;
  if (!state.pageVisible || !pageCanRunVisuals()) {
    suspendPageWork();
    return;
  }

  const renderFps = clamp(Number(state.runtimeConfig.visual.renderFps || 30), 1, 60);
  if (state.lastRenderAt && nowMs - state.lastRenderAt < 1000 / renderFps) {
    scheduleRenderLoop();
    return;
  }
  state.lastRenderAt = nowMs;

  if (state.running && state.mode === "timeline") {
    state.elapsedMs = (nowMs - state.startTime - state.pausedMs) * state.speed;
    const timeline = timelineEngine.evaluate({
      elapsedMs: state.elapsedMs,
      dataSource: state.dataSource,
      replay: state.replay,
      runtimeConfig: state.runtimeConfig,
    });
    state.currentStage = timeline.stage.name;
    state.pressure = timeline.pressure;
    state.visual = timeline.visual;
    state.currentMetrics = timeline.metrics;
    timeline.dueEvents.forEach((event) => eventBus.dispatch(event.type, event.payload, event.meta));
    setAudioPressure(state.pressure, state.currentMetrics, state.runtimeConfig.audio);
    triggerClick(state.pressure, nowMs, state.currentMetrics, state.runtimeConfig.audio);
    logState(nowMs);

    const durationLimit = state.dataSource === "replay" && state.replay.loaded ? state.replay.durationMs : timelineEngine.duration(state.runtimeConfig);
    if (state.elapsedMs >= durationLimit) {
      state.running = false;
      setAudioAudible(false);
    }
  } else if (state.mode === "manual-preview") {
    state.currentStage = "logo-test";
    state.pressure = clamp(state.pressure, 0, 1);
    state.visual = {
      pulseRate: state.runtimeConfig.visual.pulseRate,
      pulseAmplitude: state.runtimeConfig.visual.pulseAmplitude,
      brightness: state.runtimeConfig.visual.brightness,
      edgeSharpness: state.runtimeConfig.visual.edgeSharpness,
      jitter: state.runtimeConfig.visual.jitter,
      drift: state.runtimeConfig.visual.drift,
    };
    state.currentMetrics = null;
  }

  applyVisual(state.visual, nowMs);
  const readoutFps = clamp(Number(state.runtimeConfig.visual.readoutFps || 4), 1, 20);
  if (nowMs - state.lastReadoutAt >= 1000 / readoutFps) updateReadout();
  scheduleRenderLoop();
}

function bindDomEvents() {
  els.startBtn.addEventListener("click", () => eventBus.dispatch("timeline.play", {}, { source: "header" }));
  els.playPauseBtn.addEventListener("click", () => eventBus.dispatch(state.running ? "timeline.pause" : "timeline.play", {}, { source: "header" }));
  els.resetBtn.addEventListener("click", () => eventBus.dispatch("timeline.reset", {}, { source: "header" }));
  els.stopAudioBtn.addEventListener("click", () => eventBus.dispatch("audio.stop", {}, { source: "header" }));
  els.liveModeBtn.addEventListener("click", () => eventBus.dispatch("view.toggleLive", {}, { source: "header" }));
  els.liveReturnBtn.addEventListener("click", () => eventBus.dispatch("view.toggleLive", {}, { source: "live-return" }));
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "l") eventBus.dispatch("view.toggleLive", {}, { source: "keyboard" });
    if (event.key === " ") {
      event.preventDefault();
      eventBus.dispatch(state.running ? "timeline.pause" : "timeline.play", {}, { source: "keyboard" });
    }
  });
  document.addEventListener("visibilitychange", refreshPageActivity);
  window.addEventListener("focus", refreshPageActivity);
  window.addEventListener("pagehide", () => {
    suspendPageWork({ closeAudio: true });
  });
  window.addEventListener("pageshow", refreshPageActivity);
  window.addEventListener("beforeunload", () => {
    cancelRenderLoop();
    disposeLogo3d();
    stopAllAudio({ closeContext: true });
  });
  window.addEventListener("resize", () => {
    if (pageCanRunVisuals()) resizeLogo3d();
    else suspendPageWork();
  });
}

applyInitialUrlOverrides();
if (pageCanRunVisuals()) safeInitLogo3d();
bindEventHandlers();
bindDomEvents();
try {
  renderTabs();
  renderPanel();
  loadReplayData();
  if (pageCanRunVisuals()) applyVisual(state.visual);
  updateReadout();
  scheduleRenderLoop();
} catch (error) {
  publishVisualInitError(error);
  console.error("Visual boot failed", error);
}
