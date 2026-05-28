const http = require("node:http");
const {
  MODEL_CACHE,
  OLLAMA_HOST,
  PORT,
  QWEN_MODEL,
  TTS_ENGINE,
  TTS_MODEL,
  VOICE_MODE,
  ensureProjectCacheDirs,
} = require("./config");
const { handleVoiceCue } = require("./routes/voiceCue");
const { serveStatic } = require("./staticServer");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/voice-cue") {
    await handleVoiceCue(req, res);
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, "127.0.0.1", async () => {
  await ensureProjectCacheDirs();
  console.log(`Guided Baseline MVP: http://127.0.0.1:${PORT}`);
  console.log(`Local Qwen via Ollama: ${OLLAMA_HOST} (${QWEN_MODEL})`);
  console.log(`Voice mode: ${VOICE_MODE}; TTS: ${TTS_ENGINE} (${TTS_MODEL})`);
  console.log(`Project model cache: ${MODEL_CACHE}`);
});

module.exports = server;
