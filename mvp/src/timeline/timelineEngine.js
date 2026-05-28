import { REPLAY_METRIC_FIELDS, STAGE_ORDER, findStage, totalDuration } from "../config/stages.js";
import { getControlValue, setControlValue } from "../config/controlSchema.js";
import { clamp, lerp, smoothstep } from "../utils/math.js";

function metricFromFrame(frame, key, fallback) {
  const value = Number(frame?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function sanitizeMetrics(frame, fallbackPressure = 0) {
  const heartRateBpm = clamp(metricFromFrame(frame, "heartRateBpm", 72), 35, 180);
  const rrInterval = clamp(metricFromFrame(frame, "rrInterval", 60 / heartRateBpm), 0.28, 1.8);
  return {
    breathPhase: clamp(metricFromFrame(frame, "breathPhase", 0), 0, 1),
    breathRate: clamp(metricFromFrame(frame, "breathRate", 12), 4, 36),
    breathingStability: clamp(metricFromFrame(frame, "breathingStability", 0.7), 0, 1),
    heartRateBpm,
    rrInterval,
    hrvProxy: clamp(metricFromFrame(frame, "hrvProxy", 0.55), 0, 1),
    cardiacArousal: clamp(metricFromFrame(frame, "cardiacArousal", fallbackPressure), 0, 1),
    baselineDeviation: clamp(metricFromFrame(frame, "baselineDeviation", fallbackPressure), 0, 1),
    pressure: clamp(metricFromFrame(frame, "pressure", fallbackPressure), 0, 1),
  };
}

function circularLerp(a, b, t) {
  let delta = b - a;
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  return (a + delta * t + 1) % 1;
}

function metricsFromTimeline(timeline, elapsedMs, config) {
  const p = clamp(timeline.pressure, 0, 1);
  const breathRate = lerp(config.metrics.mockBreathRateMin, config.metrics.mockBreathRateMax, smoothstep(p));
  const breathPhase = ((elapsedMs / 1000) * (breathRate / 60)) % 1;
  const heartRateBpm = lerp(config.metrics.mockHeartRateMin, config.metrics.mockHeartRateMax, smoothstep(p));
  return sanitizeMetrics(
    {
      breathPhase,
      breathRate,
      breathingStability: lerp(config.metrics.mockStabilityMax, config.metrics.mockStabilityMin, p),
      heartRateBpm,
      rrInterval: 60 / heartRateBpm,
      hrvProxy: lerp(0.86, 0.16, p),
      cardiacArousal: p,
      baselineDeviation: p,
      pressure: p,
    },
    p,
  );
}

function visualFromMetrics(metrics) {
  const p = metrics.pressure;
  const breathWave = 0.5 + 0.5 * Math.sin(metrics.breathPhase * Math.PI * 2);
  const breathingInstability = 1 - metrics.breathingStability;
  const hrvTension = 1 - metrics.hrvProxy;
  const breathPulse = clamp(metrics.breathRate / 60, 0.1, 0.62);
  return {
    pulseRate: clamp(lerp(breathPulse, lerp(0.22, 2.35, smoothstep(p)), 0.58), 0.12, 2.55),
    pulseAmplitude: clamp(0.1 + breathWave * 0.08 + breathingInstability * 0.08 + p * 0.03, 0.08, 0.31),
    brightness: clamp(0.45 + p * 0.7 + metrics.cardiacArousal * 0.12, 0.16, 1.24),
    edgeSharpness: clamp(0.08 + p * 0.45 + hrvTension * 0.36, 0.02, 0.98),
    jitter: clamp(breathingInstability * 0.58 + p * 0.26, 0, 0.92),
    drift: clamp(metrics.baselineDeviation * 0.38 + breathingInstability * 0.12, 0, 0.52),
  };
}

function timelineStateFromStages(stages, elapsedMs) {
  let cursor = 0;
  for (const stage of stages) {
    const end = cursor + stage.duration;
    if (elapsedMs <= end) {
      const stageElapsed = elapsedMs - cursor;
      const stageProgress = clamp(stageElapsed / stage.duration, 0, 1);
      const eased = smoothstep(stageProgress);
      const pressure = lerp(stage.pressure[0], stage.pressure[1], eased);
      return {
        stage: findStage(stage.name),
        stageElapsed,
        stageProgress,
        pressure,
        visual: {
          pulseRate: lerp(stage.pulse[0], stage.pulse[1], eased),
          pulseAmplitude: lerp(0.13, 0.26, pressure),
          brightness: lerp(stage.brightness[0], stage.brightness[1], eased),
          edgeSharpness: lerp(stage.edge[0], stage.edge[1], eased),
          jitter: lerp(stage.jitter[0], stage.jitter[1], eased),
          drift: lerp(stage.drift[0], stage.drift[1], eased),
        },
      };
    }
    cursor = end;
  }

  const last = stages[stages.length - 1] || findStage("ending");
  return {
    stage: findStage(last.name || "ending"),
    stageElapsed: last.duration || 0,
    stageProgress: 1,
    pressure: 0,
    visual: {
      pulseRate: 0.12,
      pulseAmplitude: 0.08,
      brightness: 0.16,
      edgeSharpness: 0,
      jitter: 0,
      drift: 0,
    },
  };
}

function interpolateReplayFrame(replay, elapsedMs) {
  if (!replay.frames.length) return null;
  const timeMs = clamp(elapsedMs, 0, replay.durationMs);
  const times = replay.times;
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (times[middle] < timeMs) low = middle + 1;
    else high = middle;
  }

  const right = low;
  const left = Math.max(0, right - 1);
  const leftFrame = replay.frames[left];
  const rightFrame = replay.frames[right] || leftFrame;
  const leftTime = times[left] || 0;
  const rightTime = times[right] || leftTime;
  const amount = rightTime > leftTime ? clamp((timeMs - leftTime) / (rightTime - leftTime), 0, 1) : 0;
  const frame = {
    time: timeMs / 1000,
    stageHint: amount < 0.5 ? leftFrame.stageHint : rightFrame.stageHint,
  };

  REPLAY_METRIC_FIELDS.forEach((field) => {
    const leftValue = metricFromFrame(leftFrame, field, 0);
    const rightValue = metricFromFrame(rightFrame, field, leftValue);
    frame[field] = field === "breathPhase" ? circularLerp(leftValue, rightValue, amount) : lerp(leftValue, rightValue, amount);
  });
  return frame;
}

function replayState({ replay, elapsedMs, base }) {
  if (!replay.loaded || !replay.frames.length) return null;
  const frame = interpolateReplayFrame(replay, elapsedMs);
  const metrics = sanitizeMetrics(frame, base.pressure);
  const stageName = STAGE_ORDER.includes(frame?.stageHint) ? frame.stageHint : base.stage.name;
  return {
    ...base,
    stage: findStage(stageName),
    pressure: metrics.pressure,
    visual: visualFromMetrics(metrics),
    metrics,
  };
}

function applyParameterKeyframes(config, elapsedMs, state) {
  const keyframes = [...(config.timeline.parameterKeyframes || [])]
    .filter((keyframe) => keyframe.enabled !== false && keyframe.path)
    .sort((a, b) => a.timeMs - b.timeMs);
  const paths = [...new Set(keyframes.map((keyframe) => keyframe.path))];
  const output = structuredClone(state);

  paths.forEach((path) => {
    const pathFrames = keyframes.filter((keyframe) => keyframe.path === path);
    const previous = [...pathFrames].reverse().find((keyframe) => keyframe.timeMs <= elapsedMs);
    const next = pathFrames.find((keyframe) => keyframe.timeMs > elapsedMs);
    if (!previous && !next) return;
    if (!previous) {
      setControlValue(output, path, Number(next.value));
      return;
    }
    if (!next || previous.interpolate === false) {
      setControlValue(output, path, Number(previous.value));
      return;
    }
    const amount = clamp((elapsedMs - previous.timeMs) / Math.max(1, next.timeMs - previous.timeMs), 0, 1);
    setControlValue(output, path, lerp(Number(previous.value), Number(next.value), amount));
  });

  return output;
}

export function createTimelineEngine() {
  const firedEvents = new Set();

  function resetEvents() {
    firedEvents.clear();
  }

  function evaluate({ elapsedMs, dataSource, replay, runtimeConfig }) {
    const stages = runtimeConfig.timeline.stages;
    const base = timelineStateFromStages(stages, elapsedMs);
    const replayBased = dataSource === "replay" ? replayState({ replay, elapsedMs, base }) : null;
    const current = replayBased || {
      ...base,
      metrics: metricsFromTimeline(base, elapsedMs, runtimeConfig),
    };
    const keyed = applyParameterKeyframes(runtimeConfig, elapsedMs, {
      pressure: current.pressure,
      visual: current.visual,
    });

    const dueEvents = (runtimeConfig.timeline.eventKeyframes || [])
      .filter((event) => event.enabled !== false)
      .filter((event) => event.timeMs <= elapsedMs)
      .filter((event) => {
        const key = event.id || `${event.event}:${event.timeMs}`;
        if (firedEvents.has(key)) return false;
        firedEvents.add(key);
        return true;
      })
      .map((event) => ({
        type: event.event,
        payload: event.payload || {},
        meta: { source: "timeline", id: event.id, timeMs: event.timeMs },
      }));

    return {
      ...current,
      pressure: keyed.pressure,
      visual: keyed.visual,
      audioState: { pressure: keyed.pressure },
      dueEvents,
    };
  }

  return {
    evaluate,
    resetEvents,
    duration(runtimeConfig) {
      return runtimeConfig?.timeline?.stages?.reduce((sum, stage) => sum + stage.duration, 0) || totalDuration();
    },
    metricFromFrame,
    sanitizeMetrics,
  };
}

export { getControlValue, metricsFromTimeline, visualFromMetrics };
