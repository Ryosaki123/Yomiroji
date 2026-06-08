"""Split a long line into sentence chunks that fit the model's text-token budget.

Irodori-TTS conditions on <=256 text tokens and clamps a single generation to
<=30s, so a long speaker turn must be broken into chunks and concatenated.
"""
from __future__ import annotations

import re

# Sentence terminators. Japanese first (kept), then latin. Newlines always split.
_JA_TERM = "。．！？!?…"
_SENT_RX = re.compile(
    r"[^" + re.escape(_JA_TERM) + r"\n]*(?:[" + re.escape(_JA_TERM) + r"]+|\n|$)",
    re.UNICODE,
)
# A latin sentence end: . ! ? followed by whitespace/end.
_EN_SPLIT_RX = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str, lang: str = "ja") -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    pieces: list[str] = []
    if str(lang).startswith("en"):
        for para in text.split("\n"):
            para = para.strip()
            if not para:
                continue
            pieces.extend(s.strip() for s in _EN_SPLIT_RX.split(para) if s.strip())
    else:
        for m in _SENT_RX.finditer(text):
            s = m.group(0).strip()
            if s:
                pieces.append(s)
    return pieces or [text]


def _count_tokens(tokenizer, s: str, max_length: int) -> int:
    try:
        _ids, mask = tokenizer.batch_encode([s], max_length=max_length)
        return int(mask.sum().item())
    except Exception:
        # Fallback heuristic if tokenizer call fails.
        return max(1, len(s))


def _hard_split(s: str, max_chars: int) -> list[str]:
    out: list[str] = []
    while len(s) > max_chars:
        # try to break on a space near the limit for latin text
        cut = s.rfind(" ", 0, max_chars)
        if cut < max_chars // 2:
            cut = max_chars
        out.append(s[:cut].strip())
        s = s[cut:].strip()
    if s:
        out.append(s)
    return out


def pack_chunks(
    text: str,
    tokenizer,
    *,
    lang: str = "ja",
    max_tokens: int = 200,
    max_chars: int = 180,
) -> list[str]:
    """Greedily pack whole sentences into chunks under the token/char budget."""
    sentences = split_sentences(text, lang)
    chunks: list[str] = []
    cur = ""
    for sent in sentences:
        if len(sent) > max_chars or _count_tokens(tokenizer, sent, max_tokens + 64) > max_tokens:
            if cur:
                chunks.append(cur)
                cur = ""
            chunks.extend(_hard_split(sent, max_chars))
            continue
        cand = (cur + " " + sent).strip() if cur else sent
        if cur and (
            len(cand) > max_chars
            or _count_tokens(tokenizer, cand, max_tokens + 64) > max_tokens
        ):
            chunks.append(cur)
            cur = sent
        else:
            cur = cand
    if cur:
        chunks.append(cur)
    return [c for c in chunks if c.strip()] or [text.strip()]
