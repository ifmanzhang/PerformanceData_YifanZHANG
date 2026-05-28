import { AUDIO_SUSPEND_DELAY_MS, STEM_TRACKS } from "../config/stages.js";
import { clamp, lerp, pressureWindow, smoothstep } from "../utils/math.js";

export function createAudioEngine({ state, els, updateReadout }) {
  const audio = {
    ctx: null,
    master: null,
    calmGain: null,
    droneGain: null,
    noiseGain: null,
    tremoloGain: null,
    tremoloOsc: null,
    clickGain: null,
    noiseSource: null,
    lastClickAt: 0,
    enabled: false,
    audible: false,
    suspendTimer: null,
    loadingStems: false,
    stemsReady: false,
    stemError: null,
    stemBuffers: {},
    stems: {},
    lastMix: null,
    lastPhysioMap: null,
  };

  function setParamTarget(param, value, timeConstant = 0.16) {
    if (!param || !audio.ctx) return;
    param.setTargetAtTime(value, audio.ctx.currentTime, timeConstant);
  }

  function setParamNow(param, value) {
    if (!param || !audio.ctx) return;
    param.cancelScheduledValues(audio.ctx.currentTime);
    param.setValueAtTime(value, audio.ctx.currentTime);
  }

  function roundedAudioValue(value) {
    return Number(Number(value || 0).toFixed(4));
  }

  function roundedAudioMap(map) {
    return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, roundedAudioValue(value)]));
  }

  function audioConfig(overrides = state.runtimeConfig?.audio || {}) {
    const merged = {
      masterMin: 0.26,
      masterMax: 0.36,
      calmFallbackGain: 0.08,
      droneFallbackGain: 0.066,
      noiseFallbackGain: 0.08,
      tremoloMinHz: 0.8,
      tremoloMaxHz: 8.2,
      tremoloGainHigh: 0.018,
      clickThreshold: 0.36,
      clickGainMin: 0.0012,
      clickGainMax: 0.006,
      clickFreqMin: 82,
      clickFreqMax: 240,
      stemGain: {
        calmPad: 1,
        contemplation: 1,
        airBells: 1,
        pressureCavern: 1,
        ...(overrides.stemGain || {}),
      },
      stemFilterScale: 1,
      stemRateScale: 1,
      ...overrides,
    };
    merged.stemGain = {
      calmPad: 1,
      contemplation: 1,
      airBells: 1,
      pressureCavern: 1,
      ...(overrides.stemGain || {}),
    };
    return merged;
  }

  async function initAudio() {
    audio.audible = true;

    if (audio.enabled) {
      if (audio.ctx?.state === "suspended") {
        await audio.ctx.resume();
      }
      setAudioPressure(state.pressure, state.currentMetrics, state.runtimeConfig?.audio);
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    audio.ctx = new AudioContext();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0;
    audio.master.connect(audio.ctx.destination);

    const calmOsc = audio.ctx.createOscillator();
    const calmFilter = audio.ctx.createBiquadFilter();
    audio.calmGain = audio.ctx.createGain();
    calmOsc.type = "sine";
    calmOsc.frequency.value = 176;
    calmFilter.type = "lowpass";
    calmFilter.frequency.value = 520;
    audio.calmGain.gain.value = 0;
    calmOsc.connect(calmFilter);
    calmFilter.connect(audio.calmGain);
    audio.calmGain.connect(audio.master);
    calmOsc.start();

    const droneOsc = audio.ctx.createOscillator();
    audio.droneGain = audio.ctx.createGain();
    droneOsc.type = "triangle";
    droneOsc.frequency.value = 54;
    audio.droneGain.gain.value = 0;
    droneOsc.connect(audio.droneGain);
    audio.droneGain.connect(audio.master);
    droneOsc.start();

    const noiseBuffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 2, audio.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    audio.noiseSource = audio.ctx.createBufferSource();
    const noiseFilter = audio.ctx.createBiquadFilter();
    audio.noiseGain = audio.ctx.createGain();
    audio.noiseSource.buffer = noiseBuffer;
    audio.noiseSource.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 1.8;
    audio.noiseGain.gain.value = 0;
    audio.noiseSource.connect(noiseFilter);
    noiseFilter.connect(audio.noiseGain);
    audio.noiseGain.connect(audio.master);
    audio.noiseSource.start();

    audio.tremoloOsc = audio.ctx.createOscillator();
    audio.tremoloGain = audio.ctx.createGain();
    audio.tremoloOsc.type = "sine";
    audio.tremoloOsc.frequency.value = 3;
    audio.tremoloGain.gain.value = 0;
    audio.tremoloOsc.connect(audio.tremoloGain);
    audio.tremoloGain.connect(audio.master.gain);
    audio.tremoloOsc.start();

    audio.clickGain = audio.ctx.createGain();
    audio.clickGain.gain.value = 0.18;
    audio.clickGain.connect(audio.master);

    audio.enabled = true;
    setAudioPressure(state.pressure, state.currentMetrics, state.runtimeConfig?.audio);
    loadStemAudio();
  }

  function setAudioAudible(isAudible) {
    audio.audible = isAudible;
    if (audio.suspendTimer) {
      window.clearTimeout(audio.suspendTimer);
      audio.suspendTimer = null;
    }

    if (audio.enabled) {
      if (isAudible && audio.ctx?.state === "suspended") {
        audio.ctx.resume();
      }
      setAudioPressure(state.pressure, state.currentMetrics, state.runtimeConfig?.audio);
      if (!isAudible && audio.ctx?.state === "running") {
        audio.suspendTimer = window.setTimeout(() => {
          if (!audio.audible && audio.ctx?.state === "running") {
            audio.ctx.suspend();
          }
        }, AUDIO_SUSPEND_DELAY_MS);
      }
    }
  }

  function forceSilenceAudio() {
    if (!audio.ctx) return;

    setParamNow(audio.master?.gain, 0);
    setParamNow(audio.calmGain?.gain, 0);
    setParamNow(audio.droneGain?.gain, 0);
    setParamNow(audio.noiseGain?.gain, 0);
    setParamNow(audio.tremoloGain?.gain, 0);
    Object.values(audio.stems).forEach((stem) => {
      setParamNow(stem.gain.gain, 0);
    });
  }

  function clearAudioTimers() {
    if (audio.suspendTimer) {
      window.clearTimeout(audio.suspendTimer);
      audio.suspendTimer = null;
    }
  }

  function resetAudioGraphState() {
    clearAudioTimers();
    audio.ctx = null;
    audio.master = null;
    audio.calmGain = null;
    audio.droneGain = null;
    audio.noiseGain = null;
    audio.tremoloGain = null;
    audio.tremoloOsc = null;
    audio.clickGain = null;
    audio.noiseSource = null;
    audio.lastClickAt = 0;
    audio.enabled = false;
    audio.audible = false;
    audio.loadingStems = false;
    audio.stemsReady = false;
    audio.stemError = null;
    audio.stemBuffers = {};
    audio.stems = {};
    audio.lastMix = null;
    audio.lastPhysioMap = null;
  }

  function closeAudioGraph() {
    const context = audio.ctx;
    if (!context) {
      resetAudioGraphState();
      return;
    }

    forceSilenceAudio();
    resetAudioGraphState();
    context.close?.().catch(() => {});
  }

  function stopAllAudio({ closeContext = true } = {}) {
    state.running = false;
    state.audioTestActive = false;
    audio.audible = false;
    window.speechSynthesis?.cancel();
    if (els.voicePreview) {
      els.voicePreview.pause();
      els.voicePreview.removeAttribute("src");
      els.voicePreview.hidden = true;
      els.voicePreview.load();
    }

    if (closeContext) {
      closeAudioGraph();
    } else {
      forceSilenceAudio();
      setAudioAudible(false);
    }

    els.playPauseBtn.textContent = "开始";
    updateReadout();
  }

  async function loadStemAudio() {
    if (audio.loadingStems || audio.stemsReady || !audio.ctx) return;
    audio.loadingStems = true;

    try {
      const decodedTracks = await Promise.all(
        STEM_TRACKS.map(async (track) => {
          const response = await fetch(track.path);
          if (!response.ok) {
            throw new Error(`${track.id} failed with ${response.status}`);
          }
          const data = await response.arrayBuffer();
          const buffer = await audio.ctx.decodeAudioData(data);
          return [track.id, buffer];
        }),
      );

      decodedTracks.forEach(([id, buffer]) => {
        audio.stemBuffers[id] = buffer;
      });

      startStemLoops();
      audio.stemsReady = true;
      audio.stemError = null;
      console.info("Stem audio ready", STEM_TRACKS.map((track) => track.id).join(", "));
      setAudioPressure(state.pressure, state.currentMetrics, state.runtimeConfig?.audio);
    } catch (error) {
      audio.stemError = error.message;
      console.warn("Stem audio unavailable; using generated fallback.", error);
    } finally {
      audio.loadingStems = false;
    }
  }

  function startStemLoops() {
    STEM_TRACKS.forEach((track) => {
      if (audio.stems[track.id] || !audio.stemBuffers[track.id]) return;

      const source = audio.ctx.createBufferSource();
      const filter = audio.ctx.createBiquadFilter();
      const gain = audio.ctx.createGain();

      source.buffer = audio.stemBuffers[track.id];
      source.loop = true;
      source.playbackRate.value = 1;
      filter.type = "lowpass";
      filter.frequency.value = 7200;
      filter.Q.value = 0.55;
      gain.gain.value = 0;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      source.start();

      audio.stems[track.id] = { source, filter, gain };
    });
  }

  function setStemPressure(pressure, metrics = state.currentMetrics, configOverrides = state.runtimeConfig?.audio) {
    if (!audio.stemsReady) return;

    const config = audioConfig(configOverrides);
    const p = clamp(pressure, 0, 1);
    const hrvTension = clamp(1 - Number(metrics?.hrvProxy ?? lerp(0.86, 0.16, p)), 0, 1);
    const breathOpen = 0.5 + 0.5 * Math.sin(Number(metrics?.breathPhase ?? 0) * Math.PI * 2);
    const outputLevel = audio.audible ? 1 : 0;
    const shimmer = pressureWindow(p, 0.1, 0.55);
    const tension = clamp(pressureWindow(p, 0.34, 0.82) * 0.68 + hrvTension * 0.32, 0, 1);
    const pressureTexture = pressureWindow(p, 0.46, 0.96);
    const overload = pressureWindow(p, 0.74, 1);
    const calmDrop = smoothstep(p);
    const stemTargets = {
      calmPad: lerp(0.34, 0.14, calmDrop) * lerp(0.88, 1.08, breathOpen),
      contemplation: lerp(0.26, 0.1, calmDrop) * lerp(0.94, 1.04, breathOpen),
      airBells: lerp(0.04, 0.2, shimmer) * lerp(1, 0.55, overload),
      pressureCavern: lerp(0, 0.24, pressureTexture),
    };
    const filterTargets = {
      calmPad: lerp(9000, 3000, tension) * lerp(0.82, 1.08, breathOpen),
      contemplation: lerp(7200, 2600, tension) * lerp(0.9, 1.05, breathOpen),
      airBells: lerp(9000, 3600, Math.max(overload, hrvTension * 0.72)),
      pressureCavern: lerp(1300, 3800, pressureTexture),
    };
    const rateTargets = {
      calmPad: lerp(1, 0.992, tension),
      contemplation: lerp(1, 0.99, tension),
      airBells: lerp(0.996, 1.006, pressureTexture),
      pressureCavern: lerp(0.985, 1.035, overload),
    };

    audio.lastMix = {
      pressure: roundedAudioValue(p),
      outputLevel,
      physio: roundedAudioMap({
        breathOpen,
        hrvTension,
        heartRateBpm: Number(metrics?.heartRateBpm ?? lerp(62, 108, p)),
      }),
      stemTargets: roundedAudioMap(stemTargets),
      filterTargets: roundedAudioMap(filterTargets),
      rateTargets: roundedAudioMap(rateTargets),
    };

    Object.entries(audio.stems).forEach(([id, stem]) => {
      setParamTarget(stem.gain.gain, (stemTargets[id] || 0) * outputLevel * (config.stemGain[id] ?? 1), 0.34);
      setParamTarget(stem.filter.frequency, (filterTargets[id] || 7200) * config.stemFilterScale, 0.45);
      setParamTarget(stem.source.playbackRate, (rateTargets[id] || 1) * config.stemRateScale, 0.6);
    });
  }

  function setAudioPressure(pressure, metrics = state.currentMetrics, configOverrides = state.runtimeConfig?.audio) {
    if (!audio.enabled || !audio.ctx) return;
    const config = audioConfig(configOverrides);
    const p = clamp(pressure, 0, 1);
    const outputLevel = audio.audible ? 1 : 0;
    const hrvTension = clamp(1 - Number(metrics?.hrvProxy ?? lerp(0.86, 0.16, p)), 0, 1);
    const breathOpen = 0.5 + 0.5 * Math.sin(Number(metrics?.breathPhase ?? 0) * Math.PI * 2);
    const tension = clamp(pressureWindow(p, 0.34, 0.86) * 0.62 + hrvTension * 0.38, 0, 1);

    setParamTarget(audio.calmGain.gain, (audio.stemsReady ? lerp(0.012, 0.003, p) : lerp(config.calmFallbackGain, 0.014, p)) * outputLevel * lerp(0.82, 1.12, breathOpen), 0.22);
    setParamTarget(audio.droneGain.gain, (audio.stemsReady ? lerp(0.012, 0.028, tension) : lerp(0.04, config.droneFallbackGain, tension)) * outputLevel, 0.24);
    setParamTarget(audio.noiseGain.gain, (audio.stemsReady ? lerp(0, 0.008, tension) : lerp(0, config.noiseFallbackGain, tension)) * outputLevel, 0.28);
    setParamTarget(audio.tremoloOsc.frequency, lerp(config.tremoloMinHz, config.tremoloMaxHz, tension), 0.28);
    setParamTarget(audio.tremoloGain.gain, (audio.stemsReady ? lerp(0, config.tremoloGainHigh, tension) : lerp(0, config.tremoloGainHigh * 2.3, tension)) * outputLevel, 0.28);
    setParamTarget(audio.master.gain, audio.audible ? lerp(config.masterMin, config.masterMax, tension) : 0, 0.26);
    audio.lastPhysioMap = roundedAudioMap({
      breathOpen,
      hrvTension,
      tremoloHz: lerp(config.tremoloMinHz, config.tremoloMaxHz, tension),
    });
    setStemPressure(p, metrics, config);
  }

  function triggerClick(pressure, nowMs, metrics = state.currentMetrics, configOverrides = state.runtimeConfig?.audio) {
    const config = audioConfig(configOverrides);
    if (!audio.enabled || !audio.audible || !audio.ctx || pressure < (audio.stemsReady ? config.clickThreshold : 0.18)) return;
    const heartRateBpm = clamp(Number(metrics?.heartRateBpm ?? lerp(62, 108, pressure)), 35, 180);
    const hrvTension = clamp(1 - Number(metrics?.hrvProxy ?? lerp(0.86, 0.16, pressure)), 0, 1);
    const interval = (60000 / heartRateBpm) * lerp(1.55, 0.68, clamp(pressure * 0.72 + hrvTension * 0.28, 0, 1));
    if (nowMs - audio.lastClickAt < interval) return;
    audio.lastClickAt = nowMs;

    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = lerp(config.clickFreqMin, config.clickFreqMax, clamp(pressure * 0.72 + hrvTension * 0.28, 0, 1));
    gain.gain.setValueAtTime(0.0001, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      audio.stemsReady ? lerp(config.clickGainMin, config.clickGainMax, pressure) : lerp(0.01, 0.04, pressure),
      audio.ctx.currentTime + 0.018,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + 0.2);
  }

  function currentAudioParams() {
    const stemGains = Object.fromEntries(
      STEM_TRACKS.map((track) => [
        track.id,
        audio.stems[track.id] ? roundedAudioValue(audio.stems[track.id].gain.gain.value) : 0,
      ]),
    );
    const stemFilters = Object.fromEntries(
      STEM_TRACKS.map((track) => [
        track.id,
        audio.stems[track.id] ? roundedAudioValue(audio.stems[track.id].filter.frequency.value) : 0,
      ]),
    );
    const stemRates = Object.fromEntries(
      STEM_TRACKS.map((track) => [
        track.id,
        audio.stems[track.id] ? roundedAudioValue(audio.stems[track.id].source.playbackRate.value) : 0,
      ]),
    );

    return {
      audible: audio.audible,
      contextState: audio.ctx?.state || "uninitialized",
      stemsReady: audio.stemsReady,
      stemError: audio.stemError,
      stemGains,
      stemFilters,
      stemRates,
      lastMix: audio.lastMix,
      physiologicalMapping: audio.lastPhysioMap,
      calmGain: audio.calmGain ? roundedAudioValue(audio.calmGain.gain.value) : 0,
      droneGain: audio.droneGain ? roundedAudioValue(audio.droneGain.gain.value) : 0,
      noiseGain: audio.noiseGain ? roundedAudioValue(audio.noiseGain.gain.value) : 0,
      tremoloGain: audio.tremoloGain ? roundedAudioValue(audio.tremoloGain.gain.value) : 0,
      masterGain: audio.master ? roundedAudioValue(audio.master.gain.value) : 0,
    };
  }

  return {
    initAudio,
    setAudioAudible,
    stopAllAudio,
    setAudioPressure,
    triggerClick,
    currentAudioParams,
  };
}
