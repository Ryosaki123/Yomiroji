"""Filesystem layout for the podcast app (all local)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]   # PodcastwithIrodoriTTS/
WEB_DIR = ROOT / "web"
DATA_DIR = ROOT / "data"
VOICES_DIR = DATA_DIR / "voices"
PREVIEWS_DIR = DATA_DIR / "previews"
OUTPUTS_DIR = DATA_DIR / "outputs"

for _d in (VOICES_DIR, PREVIEWS_DIR, OUTPUTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)
