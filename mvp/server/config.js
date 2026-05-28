const fs = require("node:fs/promises");
const path = require("node:path");

const MVP_ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(MVP_ROOT, "public");
const MODEL_CACHE = path.join(MVP_ROOT, ".model-cache");

const PROJECT_CACHE_ENV = {
  OLLAMA_MODELS: process.env.OLLAMA_MODELS || path.join(MVP_ROOT, ".ollama-models"),
  HF_HOME: process.env.HF_HOME || path.join(MODEL_CACHE, "huggingface"),
  HF_HUB_CACHE: process.env.HF_HUB_CACHE || path.join(MODEL_CACHE, "huggingface", "hub"),
  HUGGINGFACE_HUB_CACHE: process.env.HUGGINGFACE_HUB_CACHE || path.join(MODEL_CACHE, "huggingface", "hub"),
  TORCH_HOME: process.env.TORCH_HOME || path.join(MODEL_CACHE, "torch"),
  XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || path.join(MODEL_CACHE, "xdg"),
  MLX_CACHE_DIR: process.env.MLX_CACHE_DIR || path.join(MODEL_CACHE, "mlx"),
  PIP_CACHE_DIR: process.env.PIP_CACHE_DIR || path.join(MODEL_CACHE, "pip"),
  UV_CACHE_DIR: process.env.UV_CACHE_DIR || path.join(MODEL_CACHE, "uv"),
  MODELSCOPE_CACHE: process.env.MODELSCOPE_CACHE || path.join(MODEL_CACHE, "modelscope"),
};

Object.entries(PROJECT_CACHE_ENV).forEach(([key, value]) => {
  process.env[key] = value;
});
delete process.env.TRANSFORMERS_CACHE;

const config = {
  MVP_ROOT,
  PUBLIC_ROOT,
  MODEL_CACHE,
  PROJECT_CACHE_ENV,
  PORT: Number(process.env.PORT || 4173),
  OLLAMA_HOST: process.env.OLLAMA_HOST || "http://127.0.0.1:11435",
  QWEN_MODEL: process.env.QWEN_MODEL || "qwen3.5:27b",
  TTS_PYTHON: process.env.TTS_PYTHON || path.join(MVP_ROOT, ".venv-qwen-tts", "bin", "python"),
  TTS_SCRIPT: path.join(MVP_ROOT, "tts", "synthesize_once.py"),
  TTS_OUTPUT_DIR: path.join(MVP_ROOT, "tts", "generated"),
  TTS_PRECOMPUTED_DIR: process.env.TTS_PRECOMPUTED_DIR || path.join(MVP_ROOT, "tts", "precomputed"),
  TTS_PRECOMPUTED_MANIFEST:
    process.env.TTS_PRECOMPUTED_MANIFEST ||
    path.join(process.env.TTS_PRECOMPUTED_DIR || path.join(MVP_ROOT, "tts", "precomputed"), "manifest.json"),
  VOICE_MODE: process.env.VOICE_MODE || "precomputed",
  TTS_ENGINE: process.env.TTS_ENGINE || "qwen3_tts_official",
  TTS_MODEL: process.env.TTS_MODEL || "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
  TTS_LANGUAGE: process.env.TTS_LANGUAGE || "English",
  TTS_VOICE: process.env.TTS_VOICE || "qwen3-voice-design",
  TTS_INSTRUCT:
    process.env.TTS_INSTRUCT ||
    "A calm intimate adult female voice, low volume, slow breath-paced delivery, soft but slightly mechanical, precise articulation, not cheerful.",
};

async function ensureProjectCacheDirs() {
  await Promise.all(
    Object.values(PROJECT_CACHE_ENV)
      .concat([config.TTS_OUTPUT_DIR, config.TTS_PRECOMPUTED_DIR])
      .map((directory) => fs.mkdir(directory, { recursive: true })),
  );
}

module.exports = {
  ...config,
  ensureProjectCacheDirs,
};
