#!/usr/bin/env bash
set -euo pipefail

# 下载/安装 Qwen 文本模型与 Qwen3-TTS 本地依赖。
# 所有下载缓存固定在项目目录内，不写到 ~/.cache。

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MVP_ROOT="${PROJECT_ROOT}/mvp"
source "${MVP_ROOT}/model-env.sh"

ENV_NAME="${CONDA_ENV_NAME:-guided-baseline-mvp}"
OLLAMA_PORT="${OLLAMA_PORT:-11435}"
OLLAMA_HOST_URL="http://127.0.0.1:${OLLAMA_PORT}"
LLM_MODEL="${QWEN_MODEL:-qwen3.5:27b}"
TTS_VENV="${TTS_VENV:-${MVP_ROOT}/.venv-qwen-tts}"
TTS_MODEL="${TTS_MODEL:-Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign}"
TTS_BOOTSTRAP_PYTHON="${TTS_BOOTSTRAP_PYTHON:-${HOME}/miniconda3/envs/guided-baseline-tts/bin/python}"

export OLLAMA_HOST="${OLLAMA_HOST_URL}"
export QWEN_MODEL="${LLM_MODEL}"
export TTS_MODEL="${TTS_MODEL}"
unset TRANSFORMERS_CACHE

mkdir -p "${OLLAMA_MODELS}" "${PROJECT_MODEL_CACHE}" "${TTS_VENV%/*}"

cleanup() {
  if [[ -n "${OLLAMA_PID:-}" ]]; then
    kill "${OLLAMA_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Cache root: ${PROJECT_MODEL_CACHE}"
echo "Ollama models: ${OLLAMA_MODELS}"

if ! curl -fsS "${OLLAMA_HOST_URL}/api/version" >/dev/null 2>&1; then
  echo "Starting project-local Ollama on ${OLLAMA_HOST_URL}"
  conda run -n "${ENV_NAME}" ollama serve &
  OLLAMA_PID=$!
  for _ in {1..80}; do
    if curl -fsS "${OLLAMA_HOST_URL}/api/version" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

echo "Pulling LLM: ${LLM_MODEL}"
conda run -n "${ENV_NAME}" ollama pull "${LLM_MODEL}"

if [[ -x "${TTS_VENV}/bin/python" ]]; then
  VENV_TOO_OLD="$("${TTS_VENV}/bin/python" - <<'PY'
import sys
print("1" if sys.version_info < (3, 10) else "0")
PY
)"
  if [[ "${VENV_TOO_OLD}" == "1" ]]; then
    echo "Recreating ${TTS_VENV}; Qwen3-TTS requires Python 3.10+"
    rm -rf "${TTS_VENV}"
  fi
fi

if [[ ! -x "${TTS_VENV}/bin/python" ]]; then
  echo "Creating project-local TTS venv: ${TTS_VENV}"
  "${TTS_BOOTSTRAP_PYTHON}" -m venv "${TTS_VENV}"
fi

echo "Installing Qwen3-TTS runtime into project venv"
"${TTS_VENV}/bin/python" -m pip install --upgrade pip
"${TTS_VENV}/bin/python" -m pip install --upgrade qwen-tts soundfile "huggingface_hub[hf_xet]"

echo "Warming Qwen3-TTS model cache inside project"
"${TTS_VENV}/bin/python" - <<PY
import os
import torch
from qwen_tts import Qwen3TTSModel
model_id = os.environ.get("TTS_MODEL", "${TTS_MODEL}")
device_map = "mps" if torch.backends.mps.is_available() else "cpu"
dtype = torch.float16 if device_map == "mps" else torch.float32
Qwen3TTSModel.from_pretrained(model_id, device_map=device_map, dtype=dtype)
print(f"Loaded {model_id}")
PY

echo "Done."
echo "Use TTS_PYTHON=${TTS_VENV}/bin/python when running pre-generation or the MVP."
