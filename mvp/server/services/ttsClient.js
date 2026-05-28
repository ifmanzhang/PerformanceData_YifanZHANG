const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");
const {
  PROJECT_CACHE_ENV,
  TTS_ENGINE,
  TTS_INSTRUCT,
  TTS_LANGUAGE,
  TTS_MODEL,
  TTS_OUTPUT_DIR,
  TTS_PYTHON,
  TTS_SCRIPT,
  TTS_VOICE,
} = require("../config");

const execFileAsync = promisify(execFile);

function ttsSpeedFor(summary) {
  if (summary.pressure === "high") return 0.74;
  if (summary.pressure === "medium") return 0.68;
  return 0.62;
}

async function synthesizeWithLocalTts(text, summary) {
  await fs.mkdir(TTS_OUTPUT_DIR, { recursive: true });
  const fileName = `cue-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.wav`;
  const outputPath = path.join(TTS_OUTPUT_DIR, fileName);
  const speed = ttsSpeedFor(summary);
  const { stdout, stderr } = await execFileAsync(
    TTS_PYTHON,
    [
      TTS_SCRIPT,
      "--text",
      text,
      "--output",
      outputPath,
      "--engine",
      TTS_ENGINE,
      "--model",
      TTS_MODEL,
      "--voice",
      TTS_VOICE,
      "--speed",
      String(speed),
      "--language",
      TTS_LANGUAGE,
      "--instruct",
      TTS_INSTRUCT,
    ],
    {
      timeout: TTS_ENGINE.startsWith("qwen3_tts") ? 180_000 : 15_000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        ...PROJECT_CACHE_ENV,
        TTS_ENGINE,
        TTS_MODEL,
        TTS_LANGUAGE,
        TTS_VOICE,
        TTS_INSTRUCT,
      },
    },
  );

  const line = stdout.trim().split("\n").pop();
  const metadata = line ? JSON.parse(line) : {};
  return {
    ...metadata,
    source: "local",
    speed,
    audioUrl: `/tts/generated/${fileName}`,
    stderr: stderr ? stderr.trim().slice(0, 400) : null,
  };
}

module.exports = {
  synthesizeWithLocalTts,
};
