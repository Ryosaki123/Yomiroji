"""Simple waveform editing for a single line WAV (trim/cut by seconds), writing
to a target path. Mirrors the seconds-based ops in irodori_tts.audio_editor.
"""
from __future__ import annotations

import numpy as np
import soundfile as sf


def _idx(seconds, sr: int, total: int) -> int:
    try:
        s = float(seconds)
    except (TypeError, ValueError):
        s = 0.0
    return max(0, min(total, int(round(s * sr))))


def edit_line(src_wav: str, out_wav: str, start_s: float, end_s: float, op: str) -> dict:
    """op: 'trim' (keep [start,end]) or 'cut' (remove [start,end])."""
    audio, sr = sf.read(str(src_wav), dtype="float32", always_2d=True)
    total = audio.shape[0]
    a = _idx(start_s, sr, total)
    b = _idx(end_s, sr, total)
    if b < a:
        a, b = b, a
    op = str(op).lower()
    if op == "trim":
        if b <= a:
            raise ValueError("Trim end must be greater than start.")
        edited = audio[a:b]
    elif op == "cut":
        edited = np.concatenate([audio[:a], audio[b:]], axis=0)
    else:
        raise ValueError(f"Unknown op: {op}")
    sf.write(str(out_wav), edited, sr)
    return {"duration": round(edited.shape[0] / float(sr), 3), "sample_rate": int(sr)}
