"""Synthesize one podcast line by cloning a voice profile's reference WAV with the
Base v3 (speaker-conditioned) model. Long lines are sentence-chunked and joined.
"""
from __future__ import annotations

import torch

from irodori_tts.inference_runtime import SamplingRequest, save_wav

from . import runtime_pool
from .chunker import pack_chunks

# Mood emoji appended to a line so the model can color delivery (optional;
# the base model is trained with an emoji palette). UI mood id -> emoji.
MOOD_EMOJI = {
    "none": "",       # explicit "no emoji" — append nothing
    "neutral": "", "excited": "😄", "curious": "🤔", "calm": "😌",
    "playful": "😏", "surprise": "😮", "warm": "🥰", "serious": "🧐",
    "whisper": "🤫", "sad": "🥺",
}

INTRA_GAP_S = 0.12  # silence between chunks of the same line


def pace_to_duration_scale(pace: float) -> float:
    try:
        pace = float(pace)
    except (TypeError, ValueError):
        pace = 1.0
    if pace <= 0:
        pace = 1.0
    return max(0.5, min(1.5, 1.0 / pace))


def _silence(n_samples: int) -> torch.Tensor:
    return torch.zeros((1, max(0, int(n_samples))), dtype=torch.float32)


def synth_line(
    *,
    text: str,
    ref_wav: str,
    out_path: str,
    seed: int,
    pace: float = 1.0,
    cfg_scale_speaker: float = 5.0,
    num_steps: int = 45,
    lang: str = "ja",
    mood: str | None = None,
) -> dict:
    """Render `text` in the cloned voice → write `out_path`. Returns {duration, sample_rate}."""
    text = (text or "").strip()
    if not text:
        raise ValueError("Line text is empty.")

    runtime = runtime_pool.get_base_runtime()
    duration_scale = pace_to_duration_scale(pace)
    emoji = MOOD_EMOJI.get(str(mood or ""), "")

    chunks = pack_chunks(text, runtime.tokenizer, lang=lang)
    sample_rate: int | None = None
    parts: list[torch.Tensor] = []
    for i, chunk in enumerate(chunks):
        chunk_text = (chunk + " " + emoji).strip() if emoji else chunk
        result = runtime.synthesize(
            SamplingRequest(
                text=chunk_text,
                ref_wav=ref_wav,
                no_ref=False,
                num_candidates=1,
                decode_mode="sequential",
                seconds=None,
                duration_scale=duration_scale,
                num_steps=int(num_steps),
                cfg_scale_speaker=float(cfg_scale_speaker),
                seed=int(seed),
                trim_tail=True,
            ),
            log_fn=None,
        )
        sample_rate = int(result.sample_rate)
        audio = result.audio.detach().to(device="cpu", dtype=torch.float32)
        if audio.ndim == 1:
            audio = audio.unsqueeze(0)
        parts.append(audio)
        if i < len(chunks) - 1:
            parts.append(_silence(int(INTRA_GAP_S * sample_rate)))

    mix = torch.cat(parts, dim=1) if len(parts) > 1 else parts[0]
    save_wav(out_path, mix, sample_rate)
    duration = mix.shape[1] / float(sample_rate)
    return {"duration": round(duration, 3), "sample_rate": sample_rate}
