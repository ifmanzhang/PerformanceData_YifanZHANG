#!/usr/bin/env bash
# 统一模型与下载缓存位置。所有缓存必须留在项目目录内。

MVP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${MVP_ROOT}/.." && pwd)"
PROJECT_MODEL_CACHE="${MVP_ROOT}/.model-cache"

export OLLAMA_MODELS="${OLLAMA_MODELS:-${MVP_ROOT}/.ollama-models}"
export HF_HOME="${HF_HOME:-${PROJECT_MODEL_CACHE}/huggingface}"
export HF_HUB_CACHE="${HF_HUB_CACHE:-${HF_HOME}/hub}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-${HF_HUB_CACHE}}"
# Transformers 5 起废弃 TRANSFORMERS_CACHE；这里直接使用 HF_HOME / HF_HUB_CACHE。
unset TRANSFORMERS_CACHE
export TORCH_HOME="${TORCH_HOME:-${PROJECT_MODEL_CACHE}/torch}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-${PROJECT_MODEL_CACHE}/xdg}"
export MLX_CACHE_DIR="${MLX_CACHE_DIR:-${PROJECT_MODEL_CACHE}/mlx}"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-${PROJECT_MODEL_CACHE}/pip}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-${PROJECT_MODEL_CACHE}/uv}"
export MODELSCOPE_CACHE="${MODELSCOPE_CACHE:-${PROJECT_MODEL_CACHE}/modelscope}"

mkdir -p \
  "${OLLAMA_MODELS}" \
  "${HF_HOME}" \
  "${HF_HUB_CACHE}" \
  "${TORCH_HOME}" \
  "${XDG_CACHE_HOME}" \
  "${MLX_CACHE_DIR}" \
  "${PIP_CACHE_DIR}" \
  "${UV_CACHE_DIR}" \
  "${MODELSCOPE_CACHE}"
