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


def load(vid: str) -> dict:
    return json.loads(_profile_path(vid).read_text(encoding="utf-8"))


def list_voices() -> list[dict]:
    out = []
    for d in sorted(VOICES_DIR.iterdir()) if VOICES_DIR.exists() else []:
        p = d / "profile.json"
        if p.is_file():
            try:
                out.append(json.loads(p.read_text(encoding="utf-8")))
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
    profile = {**profile, "ref_wav": str(dest), "updated_at": time.time()}
    profile.setdefault("created_at", profile["updated_at"])
    _profile_path(vid).write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    return profile


def update(vid: str, patch: dict) -> dict:
    """Update editable profile fields (tuning/metadata) without touching voice.wav."""
    profile = load(vid)
    allowed = {"name", "desc", "face", "language", "pace", "cfg_scale_speaker",
               "num_steps", "seed", "emotion"}
    for k, v in patch.items():
        if k in allowed and v is not None:
            profile[k] = v
    profile["updated_at"] = time.time()
    _profile_path(vid).write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    return profile


def delete(vid: str) -> bool:
    vdir = VOICES_DIR / vid
    if vdir.exists():
        shutil.rmtree(vdir, ignore_errors=True)
        return True
    return False
