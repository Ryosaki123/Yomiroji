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

### Added
- **Background render jobs**: `POST /api/podcast/render` now returns a `jobId`
  immediately and mixes on a server-side thread; new `GET /api/jobs/{id}` and
  `GET /api/jobs/active?sessionId=` endpoints (in-memory registry, `server/jobs.py`).
  The UI polls jobs and **re-attaches to a running mix after a page refresh**.
- **Global progress chip** in the top bar while a session is generating or mixing —
  click it to jump back to that session's Studio.
- `setup/requirements-server.txt`: the FastAPI/uvicorn server deps are now installed
  explicitly during offline setup instead of arriving as accidental gradio transitives.

### Changed
- **Generation survives navigation**: the generate-all loop moved from the Studio
  screen into the app shell, so switching screens/sessions no longer stops it; line
  results land in the session even when it isn't on screen.
- `run_setup_offline.bat` / `scripts/setup_offline.ps1`: accept any Python **3.12.x**
  (was: exactly 3.12.6) and no longer require pyenv-win (used only if present).
- `run_podcast.bat`: added defensive telemetry/offline guards for the air-gapped PC —
  `HF_HUB_DISABLE_TELEMETRY`, `HF_DATASETS_OFFLINE`, `GRADIO_ANALYTICS_ENABLED=False`,
  `DO_NOT_TRACK` (existing `HF_HUB_OFFLINE`/`TRANSFORMERS_OFFLINE` and the 127.0.0.1
  bind are unchanged).

### Fixed
- **Voice library now survives being copied to another machine**: voice profiles
  stored an absolute `ref_wav` path, so a relocated `data/voices/` was unrecognized and
  `GET /api/voices` 500'd (the stale path failed the under-`DATA_DIR` check). The path is
  now re-derived from each voice's folder on every read and persisted as a portable
  `"voice.wav"`; `_media_url()` returns `None` instead of raising, so one bad voice can't
  break the whole library list.
- **Fonts no longer call out to the internet**: `web/vendor/fonts.css` referenced
  `fonts.gstatic.com`. `vendor_fetch.ps1` now localizes both `.woff2` and `.ttf` faces and
  aborts if any remote URL survives; `check_offline_ready.ps1` fails the bundle if
  `fonts.css` still contains an external URL.
- **Offline setup no longer needs the network for `silentcipher`**: the air-gap bundle's
  `requirements-offline.txt` pinned it via a `git+https://` URL, which `pip --no-index`
  does *not* skip (direct URLs bypass the index), so setup tried to reach GitHub. Now
  pinned to `silentcipher==1.0.5`, resolved from the local wheelhouse.
- **Render-job concurrency races**: progress-chip pollers are now keyed by `sessionId`
  (were keyed by `jobId`) with a stale-completion guard, so an older job can no longer
  mark a session's chip done while a newer mix is still running; `prepareMix` dedupes
  concurrent play/download/rebuild so they no longer spawn duplicate server renders; and
  `jobs.find_active` returns the newest running job for a session (was the first), so
  reattach binds to the right job. _Known follow-ups (not yet fixed): refresh only
  reattaches the currently-active session's chip; `waitJob` timeouts aren't cancelled on
  unmount; the in-memory job cap is off by one; the toast timeout isn't cleared on unmount._
- **Air-gapped install actually works**: the wheelhouse was missing `aiofiles` and
  `websockets` (hard deps of gradio), so `pip install --no-index` failed on the
  offline machine and left a half-built venv. Wheelhouse completed (189 wheels) and
  verified with a strict `--ignore-installed --no-index` dry-run resolve.
- `check_offline_ready.ps1` now runs that authoritative pip dry-run resolve plus
  per-wheel and model/tokenizer presence checks, instead of name spot-checks that
  passed on a broken bundle.
- **Uploaded-voice preview now plays the clone, not your file**: creating a voice
  from an uploaded MP3/WAV synthesizes the sample line with the cloned voice for the
  preview; the raw upload is still what's saved as the voice's reference clip.

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
