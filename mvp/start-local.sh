#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${ROOT}/model-env.sh"
ENV_NAME="${CONDA_ENV_NAME:-guided-baseline-mvp}"
MODEL="${QWEN_MODEL:-qwen3.5:27b}"
OLLAMA_PORT="${OLLAMA_PORT:-11435}"
APP_PORT="${PORT:-4173}"
OLLAMA_URL="http://127.0.0.1:${OLLAMA_PORT}"

export OLLAMA_HOST="${OLLAMA_URL}"
export OLLAMA_MODELS="${ROOT}/.ollama-models"
export QWEN_MODEL="${MODEL}"
export PORT="${APP_PORT}"
export TTS_PYTHON="${TTS_PYTHON:-${ROOT}/.venv-qwen-tts/bin/python}"
export VOICE_MODE="${VOICE_MODE:-precomputed}"
export TTS_ENGINE="${TTS_ENGINE:-qwen3_tts_official}"
export TTS_MODEL="${TTS_MODEL:-Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign}"
export TTS_LANGUAGE="${TTS_LANGUAGE:-English}"
export TTS_VOICE="${TTS_VOICE:-qwen3-voice-design}"
export TTS_INSTRUCT="${TTS_INSTRUCT:-A calm intimate adult female voice, low volume, slow breath-paced delivery, soft but slightly mechanical, precise articulation, not cheerful.}"

mkdir -p "${OLLAMA_MODELS}"

cleanup() {
  if [[ -n "${OLLAMA_PID:-}" ]]; then
    kill "${OLLAMA_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Starting project-local Ollama on ${OLLAMA_HOST}"
if curl -fsS "${OLLAMA_URL}/api/version" >/dev/null 2>&1; then
  echo "Ollama is already running on ${OLLAMA_HOST}"
else
  conda run -n "${ENV_NAME}" ollama serve &
  OLLAMA_PID=$!

  for _ in {1..40}; do
    if curl -fsS "${OLLAMA_URL}/api/version" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

echo "Starting MVP app on http://127.0.0.1:${APP_PORT}"
conda run -n "${ENV_NAME}" node "${ROOT}/server/index.js"
