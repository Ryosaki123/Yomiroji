"""Holds Irodori-TTS inference runtimes (Base v3 for cloning, VoiceDesign for
voice design) resident at once, instead of the single-slot global cache in
irodori_tts.inference_runtime. Keyed by RuntimeKey so each checkpoint loads once.
"""
from __future__ import annotations

import threading

from irodori_tts.inference_runtime import (
    InferenceRuntime,
    RuntimeKey,
    default_runtime_device,
)
from irodori_tts.offline_paths import (
    BASE_MODEL_REPO,
    CODEC_REPO,
    VOICEDESIGN_MODEL_REPO,
    resolve_checkpoint_reference,
    resolve_model_reference,
)

_LOCK = threading.Lock()
_RUNTIMES: dict[RuntimeKey, InferenceRuntime] = {}


def _device() -> str:
    return default_runtime_device()  # cuda > mps > cpu


def _make_key(checkpoint_repo: str) -> RuntimeKey:
    checkpoint = resolve_checkpoint_reference(checkpoint_repo)
    dev = _device()
    return RuntimeKey(
        checkpoint=checkpoint,
        model_device=dev,
        codec_repo=resolve_model_reference(CODEC_REPO),
        model_precision="fp32",
        codec_device=dev,
        codec_precision="fp32",
        compile_model=False,
        compile_dynamic=False,
    )


def _get(checkpoint_repo: str) -> InferenceRuntime:
    key = _make_key(checkpoint_repo)
    with _LOCK:
        rt = _RUNTIMES.get(key)
        if rt is None:
            rt = InferenceRuntime.from_key(key)
            _RUNTIMES[key] = rt
        return rt


def get_base_runtime() -> InferenceRuntime:
    """Speaker-conditioned model used to clone a reference voice for every line."""
    return _get(BASE_MODEL_REPO)


def get_voicedesign_runtime() -> InferenceRuntime:
    """Caption-conditioned model used to design a brand-new voice from a prompt."""
    return _get(VOICEDESIGN_MODEL_REPO)


def device_info() -> dict:
    return {"device": _device()}


def free_all() -> int:
    with _LOCK:
        n = len(_RUNTIMES)
        for rt in _RUNTIMES.values():
            try:
                rt.unload()
            except Exception:
                pass
        _RUNTIMES.clear()
        return n
