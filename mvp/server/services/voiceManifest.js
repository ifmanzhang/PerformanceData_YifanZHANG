const fs = require("node:fs/promises");
const path = require("node:path");
const { TTS_OUTPUT_DIR } = require("../config");

async function appendVoiceManifest(entry) {
  try {
    await fs.mkdir(TTS_OUTPUT_DIR, { recursive: true });
    const manifestPath = path.join(TTS_OUTPUT_DIR, "manifest.jsonl");
    await fs.appendFile(
      manifestPath,
      `${JSON.stringify({ savedAt: new Date().toISOString(), ...entry })}\n`,
      "utf8",
    );
  } catch (manifestError) {
    console.warn("Could not write voice manifest", manifestError);
  }
}

module.exports = {
  appendVoiceManifest,
};
