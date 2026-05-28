const fs = require("node:fs/promises");
const {
  QWEN_MODEL,
  TTS_ENGINE,
  TTS_MODEL,
  TTS_PRECOMPUTED_MANIFEST,
  TTS_VOICE,
  VOICE_MODE,
} = require("../config");

let precomputedVoiceCache = null;

async function loadPrecomputedVoices() {
  if (precomputedVoiceCache) return precomputedVoiceCache;
  try {
    const raw = await fs.readFile(TTS_PRECOMPUTED_MANIFEST, "utf8");
    const payload = JSON.parse(raw);
    const cues = Array.isArray(payload.cues) ? payload.cues : [];
    precomputedVoiceCache = {
      meta: payload.meta || {},
      cues: cues.filter((cue) => cue && cue.text && cue.audioUrl),
    };
  } catch {
    precomputedVoiceCache = { meta: {}, cues: [] };
  }
  return precomputedVoiceCache;
}

function pressureBucket(pressureLabel) {
  if (pressureLabel === "high") return "high";
  if (pressureLabel === "medium") return "medium";
  return "low";
}

async function pickPrecomputedVoice(summary) {
  if (!VOICE_MODE.includes("precomputed")) return null;
  const manifest = await loadPrecomputedVoices();
  if (!manifest.cues.length) return null;

  const bucket = pressureBucket(summary.pressure);
  const stageMatches = manifest.cues.filter((cue) => cue.stage === summary.stage);
  const pressureMatches = stageMatches.filter((cue) => cue.pressure === bucket);
  const candidates = pressureMatches.length ? pressureMatches : stageMatches.length ? stageMatches : manifest.cues;
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

function toVoiceResponse(precomputedCue, summary) {
  return {
    text: precomputedCue.text,
    source: "precomputed",
    model: precomputedCue.textModel || QWEN_MODEL,
    promptSummary: summary,
    audioUrl: precomputedCue.audioUrl,
    tts: {
      source: "precomputed",
      engine: precomputedCue.ttsEngine || TTS_ENGINE,
      model: precomputedCue.ttsModel || TTS_MODEL,
      voice: precomputedCue.voice || TTS_VOICE,
      durationSeconds: precomputedCue.durationSeconds || null,
    },
    error: null,
  };
}

module.exports = {
  pickPrecomputedVoice,
  toVoiceResponse,
};
