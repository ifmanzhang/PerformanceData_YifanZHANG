import { CUE_OFFSETS, VOICE_CUES } from "../config/stages.js";
import { lerp } from "../utils/math.js";

export function createVoiceClient({ state, els, currentAudioParams, roundedMetrics, updateReadout }) {
  function voiceConfig() {
    return {
      browserRate: 0.7,
      overloadRate: 0.78,
      browserPitch: 0.88,
      overloadPitch: 0.82,
      browserVolume: 0.58,
      previewVolume: 0.62,
      overloadPreviewVolume: 0.68,
      cueDelayMinMs: 1200,
      cueDelayMaxMs: 3600,
      ...(state.runtimeConfig?.voice || {}),
    };
  }

  function pickFallbackCue(stageName) {
    const lines = VOICE_CUES[stageName] || VOICE_CUES.calm;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function speakWithBrowserVoice(stageName, text) {
    if (!("speechSynthesis" in window)) return;
    const config = voiceConfig();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = stageName === "overload" ? config.overloadRate : config.browserRate;
    utterance.pitch = stageName === "overload" ? config.overloadPitch : config.browserPitch;
    utterance.volume = config.browserVolume;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function playTtsAudio(audioUrl, stageName, text) {
    if (!audioUrl || !els.voicePreview) {
      speakWithBrowserVoice(stageName, text);
      return;
    }

    window.speechSynthesis?.cancel();
    els.voicePreview.hidden = false;
    els.voicePreview.src = audioUrl;
    const config = voiceConfig();
    els.voicePreview.volume = stageName === "overload" ? config.overloadPreviewVolume : config.previewVolume;
    els.voicePreview.load();
    try {
      await els.voicePreview.play();
    } catch {
      speakWithBrowserVoice(stageName, text);
      els.voicePreview.hidden = true;
    }
  }

  function speakCue(stageName, text, meta = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      elapsedMs: Math.round(state.elapsedMs),
      stage: stageName,
      text,
      dataSource: state.dataSource,
      replaySource: state.replay.meta?.sourceType || null,
      physiologicalMetrics: roundedMetrics(state.currentMetrics),
      visualState: {
        pulseRate: Number(state.visual.pulseRate.toFixed(4)),
        brightness: Number(state.visual.brightness.toFixed(4)),
        jitter: Number(state.visual.jitter.toFixed(4)),
        drift: Number(state.visual.drift.toFixed(4)),
        edgeSharpness: Number(state.visual.edgeSharpness.toFixed(4)),
      },
      audioParams: currentAudioParams(),
      source: meta.source || "fallback",
      model: meta.model || null,
      promptSummary: meta.promptSummary || null,
      audioUrl: meta.audioUrl || null,
      tts: meta.tts || null,
      error: meta.error || null,
    };
    state.voiceLogs.push(event);
    state.lastVoiceText = text;
    state.lastTtsStatus = meta.tts?.engine
      ? `${meta.tts.engine} / ${meta.tts.voice || "voice"}`
      : meta.audioUrl
        ? "本地 TTS 已生成"
        : "浏览器语音备用";
    updateReadout();

    playTtsAudio(meta.audioUrl, stageName, text);
  }

  async function requestVoiceCue(stageName, fallbackText) {
    state.pendingVoiceRequests += 1;
    try {
      const response = await fetch("/api/voice-cue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: stageName,
          elapsedMs: Math.round(state.elapsedMs),
          pressure: state.pressure,
          visual: state.visual,
          dataSource: state.dataSource,
          replayMeta: state.replay.meta,
          metrics: state.currentMetrics,
          fallbackText,
        }),
      });

      if (!response.ok) {
        throw new Error(`voice cue request failed: ${response.status}`);
      }

      const data = await response.json();
      speakCue(stageName, data.text || fallbackText, {
        source: data.source || "fallback",
        model: data.model || null,
        promptSummary: data.promptSummary || null,
        audioUrl: data.audioUrl || null,
        tts: data.tts || null,
        error: data.error || null,
      });
    } catch (error) {
      speakCue(stageName, fallbackText, {
        source: "client-fallback",
        error: error.message,
      });
    } finally {
      state.pendingVoiceRequests -= 1;
    }
  }

  function maybeTriggerVoiceCue(timelineState) {
    const stageName = timelineState.stage.name;
    const offsets = CUE_OFFSETS[stageName] || [];

    offsets.forEach((offset, index) => {
      const key = `${stageName}:${index}`;
      if (state.firedCues.has(key)) return;
      if (timelineState.stageProgress >= offset) {
        state.firedCues.add(key);
        const config = voiceConfig();
        const delay = Math.round(lerp(config.cueDelayMinMs, config.cueDelayMaxMs, Math.random()));
        window.setTimeout(() => {
          if (state.running || state.mode === "voice") {
            requestVoiceCue(stageName, pickFallbackCue(stageName));
          }
        }, delay);
      }
    });
  }

  return {
    pickFallbackCue,
    requestVoiceCue,
    maybeTriggerVoiceCue,
    stopVoice() {
      window.speechSynthesis?.cancel();
      if (els.voicePreview) {
        els.voicePreview.pause();
        els.voicePreview.removeAttribute("src");
        els.voicePreview.hidden = true;
        els.voicePreview.load();
      }
    },
  };
}
