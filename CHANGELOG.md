# Changelog

All notable changes to **Yomiroji** (a fully local, offline podcast maker powered
by Irodori TTS) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

> How to use this file: add new work under **[Unreleased]** as you go. When you cut
> a release, move those notes under a new `## [x.y.z] - YYYY-MM-DD` heading and post
> it as the GitHub Release notes.

## [Unreleased]

<!-- Add upcoming changes here, grouped by Added / Changed / Fixed / Removed. -->

## [0.1.0] - 2026-06-09

First public release. A React single-page app (`web/`) talking to a local FastAPI
backend (`server/`) that runs Irodori-TTS. MIT-licensed and offline at runtime; ships
no model weights — `setup_irodori.bat` reproduces the engine from public sources.
Verified end-to-end on a fresh clone (Python 3.12.x).

### Added
- **Script → Cast → Studio** workflow with a session sidebar (multiple podcast
  projects, persisted on-device) and Japanese/English UI.
- **Script parsing** of `Name: text` scripts (up to 4 speakers); `SCRIPT_FORMAT.md`
  documents the format and includes an LLM prompt for generating scripts.
- **Voice library** persisted on the backend (`data/voices/`), reusable across
  sessions. Three creation methods: **design by prompt** (VoiceDesign), **upload a
  reference clip**, and **auto (seed)**. Every line is cloned from the saved
  reference with Base v3.
- **Character Manager** (🎭): session-independent create / preview / edit / delete
  of voices, with a backend update endpoint.
- **Studio**: per-line edit/preview, **↻ Regenerate** (fresh take), **⚙ per-line
  settings** (seed reroll, pace, voice strength, quality, mood incl. **🚫 no-emoji**),
  **⏸ per-line pause** (default 0.2s), **✨ Generate all** and **🔄 Regenerate all**.
- **Final output** settings (tempo / lead-in / peak), **🔁 Rebuild podcast**, full
  combined-WAV player, and **download** of the podcast `.wav` + **SRT / WebVTT /
  JSON** transcript (exact timestamps from measured durations).
- **Dark mode** toggle (🌙/☀️) and a ⚙ button to reveal advanced look/language
  settings.
- Default generation quality `num_steps` = 45 (slider up to 120).
- **Air-gapped tooling**: `vendor_fetch.ps1` (one-time asset fetch),
  `check_offline_ready.ps1`, `package_offline.ps1`, and `run_podcast.bat` launcher.
- English + Japanese READMEs (`README.md`, `README.ja.md`) with a language switcher.
- **Setup & licensing for public use**: `LICENSE` (MIT) and `CREDITS.md` (attributing the
  Irodori-TTS engine + models to Aratako, MIT, with the models' ethical-use note);
  `setup_irodori.bat`/`.ps1` that clones upstream Irodori-TTS at the pinned commit,
  applies the offline patch, builds a venv, and downloads the MIT models from Hugging
  Face; `setup/` (offline patch + requirements); and Prerequisites/Setup docs. The repo
  redistributes no model weights.

### Notes
- Irodori parameter mapping: Pace → `duration_scale`, Voice strength →
  `cfg_scale_speaker`, Quality → `num_steps`; pitch is omitted (the model has none);
  mood is an optional emoji appended to the line text.
- The backend sends `Cache-Control: no-store` so frontend edits load on refresh.
