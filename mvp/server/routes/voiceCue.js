const { QWEN_MODEL, TTS_VOICE } = require("../config");
const {
  buildPrompt,
  buildPromptSummary,
  cleanSentence,
  generateWithQwen,
  isUsableSentence,
} = require("../services/qwenClient");
const { pickPrecomputedVoice, toVoiceResponse } = require("../services/precomputedVoiceStore");
const { synthesizeWithLocalTts } = require("../services/ttsClient");
const { appendVoiceManifest } = require("../services/voiceManifest");

const FALLBACK_CUES = {
  calm: [
    "You do not need to do anything.",
    "Let quiet arrive by itself.",
  ],
  guidance: [
    "Try not to try.",
    "Nothing needs to be solved.",
    "The signal waits softly.",
    "A small rule opens.",
  ],
  evaluation: [
    "There is nothing to improve.",
    "Soften the effort.",
    "The system waits with patience.",
    "Quiet signals find their mark.",
  ],
  overload: [
    "Rest without proving it.",
    "Almost quiet now.",
    "Stay with the quiet.",
    "No need to force it.",
  ],
  ending: [
    "I am still here.",
    "You may stop trying.",
  ],
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function pickFallback(stage) {
  const lines = FALLBACK_CUES[stage] || FALLBACK_CUES.calm;
  return lines[Math.floor(Math.random() * lines.length)];
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleVoiceCue(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const summary = buildPromptSummary(body);
  const prompt = buildPrompt(summary);
  const fallbackText = cleanSentence(body.fallbackText) || pickFallback(summary.stage);

  const precomputedCue = await pickPrecomputedVoice(summary);
  if (precomputedCue) {
    const responseBody = toVoiceResponse(precomputedCue, summary);
    await appendVoiceManifest(responseBody);
    sendJson(res, 200, responseBody);
    return;
  }

  let text = fallbackText;
  let source = "fallback";
  let error = null;

  try {
    const generated = await generateWithQwen(prompt);
    if (!isUsableSentence(generated)) {
      throw new Error(`Rejected model output: ${generated}`);
    }
    text = generated;
    source = "ollama";
  } catch (generationError) {
    source = "fallback";
    error = generationError.message;
  }

  try {
    const tts = await synthesizeWithLocalTts(text, summary);
    const responseBody = {
      text,
      source,
      model: QWEN_MODEL,
      promptSummary: summary,
      audioUrl: tts.audioUrl,
      tts,
      error,
    };
    await appendVoiceManifest(responseBody);
    sendJson(res, 200, responseBody);
  } catch (ttsError) {
    const responseBody = {
      text,
      source,
      model: QWEN_MODEL,
      promptSummary: summary,
      audioUrl: null,
      tts: {
        source: "tts-fallback",
        engine: null,
        voice: TTS_VOICE,
        error: ttsError.message,
      },
      error,
    };
    await appendVoiceManifest(responseBody);
    sendJson(res, 200, responseBody);
  }
}

module.exports = {
  handleVoiceCue,
};
