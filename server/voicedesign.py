"""Create a brand-new voice. Three methods produce a reference WAV that Base v3
later clones for every line:
  - design: VoiceDesign model speaks a sample line in a voice described by a prompt
  - auto:   Base v3 no_ref + fixed seed (a random-but-reproducible voice)
  - upload: caller supplies the reference audio directly (handled in main.py)
"""
from __future__ import annotations

import torch

from irodori_tts.inference_runtime import SamplingRequest, save_wav

from . import runtime_pool

DESIGN_SECONDS = 7.0  # VoiceDesign has no duration predictor -> set an explicit length

SAMPLE_LINE = {
    "ja": "こんにちは。これがこの声のサンプルです。よろしくお願いします。",
    "en": "Hello there. This is a sample of how this voice sounds.",
}


def _sample_line(lang: str) -> str:
    return SAMPLE_LINE.get("en" if str(lang).startswith("en") else "ja", SAMPLE_LINE["ja"])


def design_voice(
    *,
    out_path: str,
    caption: str,
    seed: int,
    lang: str = "ja",
    num_steps: int = 45,
    sample_text: str | None = None,
) -> dict:
    """VoiceDesign: synth a sample line in the voice described by `caption`."""
    caption = (caption or "").strip()
    if not caption:
        raise ValueError("A voice-design prompt (caption) is required.")
    runtime = runtime_pool.get_voicedesign_runtime()
    text = (sample_text or "").strip() or _sample_line(lang)
    result = runtime.synthesize(
        SamplingRequest(
            text=text,
            caption=caption,
            no_ref=True,
            num_candidates=1,
            decode_mode="sequential",
            seconds=float(DESIGN_SECONDS),
            num_steps=int(num_steps),
            seed=int(seed),
            trim_tail=True,
        ),
        log_fn=None,
    )
    sr = int(result.sample_rate)
    audio = result.audio.detach().to(device="cpu", dtype=torch.float32)
    if audio.ndim == 1:
        audio = audio.unsqueeze(0)
    save_wav(out_path, audio, sr)
    return {"duration": round(audio.shape[1] / float(sr), 3), "sample_rate": sr}


def auto_voice(
    *,
    out_path: str,
    seed: int,
    lang: str = "ja",
    num_steps: int = 45,
    sample_text: str | None = None,
) -> dict:
    """Base v3 with no reference + fixed seed -> a reproducible auto voice."""
    runtime = runtime_pool.get_base_runtime()
    text = (sample_text or "").strip() or _sample_line(lang)
    result = runtime.synthesize(
        SamplingRequest(
            text=text,
            no_ref=True,
            num_candidates=1,
            decode_mode="sequential",
            seconds=None,
            num_steps=int(num_steps),
            seed=int(seed),
            trim_tail=True,
        ),
        log_fn=None,
    )
    sr = int(result.sample_rate)
    audio = result.audio.detach().to(device="cpu", dtype=torch.float32)
    if audio.ndim == 1:
        audio = audio.unsqueeze(0)
    save_wav(out_path, audio, sr)
    return {"duration": round(audio.shape[1] / float(sr), 3), "sample_rate": sr}
