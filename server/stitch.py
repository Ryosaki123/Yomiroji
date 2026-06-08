"""Combine per-line WAVs into ONE podcast WAV with gaps, optional pitch-preserving
tempo change, and peak normalization, and compute each segment's start/end for
the transcript.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import soundfile as sf


def _read_mono(path: str) -> tuple[np.ndarray, int]:
    audio, sr = sf.read(str(path), dtype="float32", always_2d=True)
    if audio.shape[1] > 1:
        audio = audio.mean(axis=1, keepdims=True)
    return audio[:, 0], int(sr)


def time_stretch(wav: np.ndarray, rate: float) -> np.ndarray:
    """Pitch-preserving tempo change. rate>1 = faster/shorter, rate<1 = slower."""
    if wav.size == 0 or abs(rate - 1.0) < 1e-3:
        return wav
    import torch
    import torchaudio

    x = torch.from_numpy(np.ascontiguousarray(wav)).float()
    n_fft, hop = 2048, 512
    win = torch.hann_window(n_fft)
    spec = torch.stft(x, n_fft, hop_length=hop, window=win, return_complex=True)
    freq = spec.shape[0]
    phase_adv = torch.linspace(0, math.pi * hop, freq)[..., None]
    stretched = torchaudio.functional.phase_vocoder(spec, float(rate), phase_adv)
    out = torch.istft(stretched, n_fft, hop_length=hop, window=win)
    return out.detach().cpu().numpy().astype("float32", copy=False)


def stitch(
    segments: list[dict],
    out_wav: str,
    *,
    lead_in_s: float = 0.2,
    peak: float = 0.97,
    gap_scale: float = 1.0,
    tempo: float = 1.0,
) -> dict:
    """segments: ordered [{speaker, text, wav, pauseAfter}]. Returns {duration,
    sample_rate, segments:[{index,speaker,text,start,end}]}.
    """
    if not segments:
        raise ValueError("No segments to stitch.")

    lead_in_s = max(0.0, float(lead_in_s))
    gap_scale = max(0.0, float(gap_scale))
    peak = max(0.05, min(1.0, float(peak)))

    sr: int | None = None
    pieces: list[np.ndarray] = []
    timed: list[dict] = []
    cursor = lead_in_s

    for i, seg in enumerate(segments):
        wav, this_sr = _read_mono(seg["wav"])
        if sr is None:
            sr = this_sr
            if lead_in_s > 0:
                pieces.append(np.zeros(int(lead_in_s * sr), dtype="float32"))
        elif this_sr != sr:
            raise ValueError(f"Sample-rate mismatch: {this_sr} != {sr} ({seg['wav']})")

        start = cursor
        pieces.append(wav)
        dur = len(wav) / float(sr)
        end = start + dur
        timed.append(
            {"index": i, "speaker": seg.get("speaker", ""), "text": seg.get("text", ""),
             "start": start, "end": end}
        )
        pause = float(seg.get("pauseAfter", 0.0) or 0.0) * gap_scale
        if i < len(segments) - 1 and pause > 0:
            pieces.append(np.zeros(int(pause * sr), dtype="float32"))
        cursor = end + (pause if i < len(segments) - 1 else 0.0)

    mix = np.concatenate(pieces) if len(pieces) > 1 else pieces[0]

    # pitch-preserving tempo: stretch the final mix and scale all timings uniformly
    rate = float(tempo)
    if abs(rate - 1.0) >= 1e-3:
        mix = time_stretch(mix, rate)
        for t in timed:
            t["start"] /= rate
            t["end"] /= rate

    m = float(np.max(np.abs(mix))) if mix.size else 0.0
    if m > 0:
        mix = mix * (peak / m)

    for t in timed:
        t["start"] = round(t["start"], 3)
        t["end"] = round(t["end"], 3)

    out = Path(out_wav)
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out), mix, sr)
    return {"duration": round(len(mix) / float(sr), 3), "sample_rate": sr, "segments": timed}
