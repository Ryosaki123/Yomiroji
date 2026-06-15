"""Persistent voice library. Each voice = data/voices/<id>/{voice.wav, profile.json}.
The voice.wav is the reference clip Base v3 clones for every line.
"""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from .paths import VOICES_DIR

# Built-in starter voices are created lazily on first run (so the library is never
# empty). They are generated as "auto" voices the first time list_voices() runs.
BUILTIN_SEEDS = [
    {"id": "builtin-spark", "name": "Spark", "face": "⚡️", "desc": "Energetic host", "seed": 11, "lang": "ja"},
    {"id": "builtin-sage", "name": "Sage", "face": "🌙", "desc": "Calm narrator", "seed": 23, "lang": "ja"},
    {"id": "builtin-doc", "name": "Doc", "face": "🤓", "desc": "Skeptical expert", "seed": 47, "lang": "ja"},
    {"id": "builtin-bubbles", "name": "Bubbles", "face": "🫧", "desc": "Bubbly co-host", "seed": 65, "lang": "ja"},
]


def _profile_path(vid: str) -> Path:
    return VOICES_DIR / vid / "profile.json"


def voice_wav_path(vid: str) -> Path:
    return VOICES_DIR / vid / "voice.wav"


def exists(vid: str) -> bool:
    return _profile_path(vid).is_file() and voice_wav_path(vid).is_file()


def _normalize(profile: dict, vid: str) -> dict:
    """Always derive ref_wav from the voice's current location on disk.

    Profiles created on another machine (or before relocation) may carry a stale
    absolute ref_wav path. The voice.wav always lives at VOICES_DIR/<id>/voice.wav,
    so we re-anchor it here — this keeps the library portable across machines and
    air-gap copies regardless of what's persisted in profile.json.
    """
    profile["ref_wav"] = str(voice_wav_path(vid))
    return profile


def load(vid: str) -> dict:
    return _normalize(json.loads(_profile_path(vid).read_text(encoding="utf-8")), vid)


def list_voices() -> list[dict]:
    out = []
    for d in sorted(VOICES_DIR.iterdir()) if VOICES_DIR.exists() else []:
        p = d / "profile.json"
        if p.is_file() and (d / "voice.wav").is_file():
            try:
                out.append(_normalize(json.loads(p.read_text(encoding="utf-8")), d.name))
            except Exception:
                pass
    return out


def save(profile: dict, source_wav: str) -> dict:
    """Persist a profile, copying source_wav -> voices/<id>/voice.wav."""
    vid = profile["id"]
    vdir = VOICES_DIR / vid
    vdir.mkdir(parents=True, exist_ok=True)
    dest = vdir / "voice.wav"
    if Path(source_wav).resolve() != dest.resolve():
        shutil.copyfile(source_wav, dest)
    # Persist only the portable filename so profile.json is machine-independent.
    # Readers call _normalize() which re-derives the real absolute path at load time.
    to_disk = {**profile, "ref_wav": "voice.wav", "updated_at": time.time()}
    to_disk.setdefault("created_at", to_disk["updated_at"])
    _profile_path(vid).write_text(json.dumps(to_disk, ensure_ascii=False, indent=2), encoding="utf-8")
    return _normalize({**to_disk}, vid)


def update(vid: str, patch: dict) -> dict:
    """Update editable profile fields (tuning/metadata) without touching voice.wav."""
    profile = load(vid)  # _normalize sets ref_wav to absolute path in memory
    allowed = {"name", "desc", "face", "language", "pace", "cfg_scale_speaker",
               "num_steps", "seed", "emotion"}
    for k, v in patch.items():
        if k in allowed and v is not None:
            profile[k] = v
    profile["updated_at"] = time.time()
    # Write only the portable filename; _normalize will re-derive the path on read.
    to_disk = {**profile, "ref_wav": "voice.wav"}
    _profile_path(vid).write_text(json.dumps(to_disk, ensure_ascii=False, indent=2), encoding="utf-8")
    return profile  # already has absolute ref_wav from load() -> _normalize()


def delete(vid: str) -> bool:
    vdir = VOICES_DIR / vid
    if vdir.exists():
        shutil.rmtree(vdir, ignore_errors=True)
        return True
    return False
