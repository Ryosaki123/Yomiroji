"""Write SRT / WebVTT / JSON transcripts from timed segments (the "ASR file").

Timings are exact: derived from the known text + measured per-line audio length,
so they line up perfectly with the rendered podcast for video syncing.
"""
from __future__ import annotations

import json
from pathlib import Path


def _ts(seconds: float, *, comma: bool) -> str:
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms == 1000:
        ms = 0
        s += 1
    sep = "," if comma else "."
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def _line_text(seg: dict, *, with_speaker: bool) -> str:
    text = (seg.get("text") or "").replace("\n", " ").strip()
    spk = (seg.get("speaker") or "").strip()
    return f"{spk}: {text}" if with_speaker and spk else text


def write_srt(segments: list[dict], path: str, *, with_speaker: bool = True) -> str:
    out = []
    for i, seg in enumerate(segments, start=1):
        out.append(str(i))
        out.append(f"{_ts(seg['start'], comma=True)} --> {_ts(seg['end'], comma=True)}")
        out.append(_line_text(seg, with_speaker=with_speaker))
        out.append("")
    Path(path).write_text("\n".join(out), encoding="utf-8")
    return path


def write_vtt(segments: list[dict], path: str, *, with_speaker: bool = True) -> str:
    out = ["WEBVTT", ""]
    for i, seg in enumerate(segments, start=1):
        out.append(str(i))
        out.append(f"{_ts(seg['start'], comma=False)} --> {_ts(seg['end'], comma=False)}")
        out.append(_line_text(seg, with_speaker=with_speaker))
        out.append("")
    Path(path).write_text("\n".join(out), encoding="utf-8")
    return path


def write_json(segments: list[dict], path: str, *, meta: dict | None = None) -> str:
    payload = {"meta": meta or {}, "segments": segments}
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def write_all(segments: list[dict], stem: str, *, with_speaker: bool = True, meta: dict | None = None) -> dict:
    return {
        "srt": write_srt(segments, stem + ".srt", with_speaker=with_speaker),
        "vtt": write_vtt(segments, stem + ".vtt", with_speaker=with_speaker),
        "json": write_json(segments, stem + ".json", meta=meta),
    }
