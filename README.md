# Yomiroji

🌐 **English** · [日本語](README.ja.md)

A fully local, offline podcast maker. Paste an LLM-written script with speaker tags,
give each speaker a distinct cloned voice, and render the whole conversation into
**one podcast WAV** plus a timestamped transcript (SRT / WebVTT / JSON) for syncing
with a video clip later.

It reuses the Japanese **Irodori-TTS** models bundled in `../IrodoriTTS-offline`
(no API, no external network at runtime). Primary audience is Japanese; English is
structurally supported (per-voice language) and can be validated with an English
checkpoint later.

It's a small **React single-page app** (`web/`) talking to a local **FastAPI backend**
(`server/`) that runs the TTS. Both reuse the existing `../IrodoriTTS-offline` venv —
no extra Python dependencies.

---

## First-time setup

1. Make sure `../IrodoriTTS-offline` is set up (its `.venv` exists — run that project's
   `run_setup_offline.bat` once if not).
2. Vendor the frontend assets **once** (needs network this one time):
   ```powershell
   .\vendor_fetch.ps1
   ```
   (Already done if `web/vendor/react.production.min.js` exists.) After this, the app
   runs 100% offline.

## Run

```cmd
run_podcast.bat
```
Then open <http://127.0.0.1:7864>. You can run it with Wi-Fi off.

> After changing any code, **restart the server** (close the `run_podcast.bat` window
> and re-run) and **refresh the browser**. The backend sends `Cache-Control: no-store`,
> so a normal refresh is enough to pick up frontend edits.

---

## The workflow: Script → Cast → Studio

A left **sidebar** holds your sessions (podcast projects). **＋ New podcast** starts one;
rename a session by clicking its title in the top bar (✎), the **✎** button on the
sidebar row, or double-clicking it. Everything is saved on-device.

### 1 · Script
Paste a script or drop a `.txt`. Lines are `Name: spoken text` (Japanese `：` works too).
Detected speakers appear on the right. **Up to 4 speakers**; reuse the exact same name
spelling for each. See **`SCRIPT_FORMAT.md`** for the full format and an LLM prompt you
can use to generate scripts.

### 2 · Cast
Assign a **voice** to each speaker and fine-tune it:
- **Pace**, **Voice strength**, **Default mood** (incl. a **🚫 no-emoji** option), language.
- Pick a saved voice from your **library**, or **＋ New** to create one.
- **Save as character** stores the current tuning as a new reusable voice.

### 3 · Studio
- **✨ Generate all voices** — synthesize the lines that aren't generated yet.
- **🔄 Regenerate all voices** — force re-synthesize **every** line with the current
  settings (use after changing a voice/tuning, or to redo everything). Keeps each line's
  seed so it applies your changes deterministically.
- Per line: edit the text, set a **mood** (or 🚫 none), **↻ Regenerate** that one line
  (a fresh take), set the **⏸ pause** after it, and open **⚙ line settings** to override
  **seed** (with 🎲 reroll), **pace**, **strength**, and **quality (steps)** just for that line.
- **Final output** panel — applies to the combined podcast (press Rebuild/Play/Download
  to apply): **テンポ/Tempo** (pitch-preserving speed), **lead-in** silence, **peak** level.
- **🔁 Rebuild podcast** re-stitches the final mix from the current line takes.
- **▶ player** plays the full combined podcast; **⬇ Download** saves the `.wav` and the
  **transcript** (SRT / WebVTT / JSON) appears next to it.

---

## Voice library & Character Manager

Voices live on the backend in `data/voices/<id>/` (a reference `voice.wav` + `profile.json`)
and are **reusable across all sessions**. Open the **🎭 Characters** manager (sidebar or top
bar) any time to **create, preview, edit, and delete** voices independently of a session.

Three ways to make a voice:
- **Design by prompt** — describe the voice; the VoiceDesign model generates it. The
  **Regenerate** button rerolls the seed for a different voice each time.
- **Upload reference audio** — drop a short clip (wav/mp3/…, ≤30 s) to clone.
- **Auto (seed)** — a reproducible voice from a fixed seed, no reference needed.

Every podcast line is then **cloned** from the saved reference with Base v3.

> Note: assigning a character in Cast **copies** its tuning onto the speaker. If you later
> edit that character in the manager, re-select it on the Cast screen to pull the new
> settings into an existing session, then **Regenerate all voices**.

---

## How the UI maps to Irodori parameters

The controls are mapped to the model's real capabilities (the model has no pitch or
trained emotion axis):

| UI control       | Irodori parameter                                      |
| ---------------- | ------------------------------------------------------ |
| Pace             | `duration_scale` (= 1 / pace)                          |
| Voice strength   | `cfg_scale_speaker`                                    |
| Quality          | `num_steps` (default **45**, slider up to 120)         |
| Voice identity   | cloned **reference WAV** + fixed per-voice seed         |
| Mood (emoji)     | optional emoji appended to the line text; **🚫 = none** |
| Tempo (output)   | pitch-preserving time-stretch of the final mix          |
| (Pitch)          | omitted — Base v3 has no pitch control                  |

Long speaker turns are automatically sentence-chunked (≤256 tokens / ≤30 s per
generation) and concatenated. Transcript timestamps are exact (derived from the known
text + measured audio length), so they line up with the rendered podcast.

---

## Layout

```
server/            FastAPI backend wrapping irodori_tts
  main.py          REST API + static serving (no-store) + uvicorn entry
  runtime_pool.py  Base v3 + VoiceDesign runtimes, free_all()
  synth.py         per-line synth: chunk → clone → concat (pace/strength/steps/seed/mood)
  voicedesign.py   design / auto voice creation
  voices.py        voice library store (create / load / update / delete)
  chunker.py       sentence split + token-budget packing
  stitch.py        combine lines + gaps + tempo + peak → podcast.wav
  transcript.py    SRT / WebVTT / JSON
web/               React SPA (vendored libs/fonts under web/vendor/)
data/
  voices/<id>/     voice.wav + profile.json   (the reusable library)
  outputs/<id>/    seg_*.wav, podcast.wav + podcast.srt/.vtt/.json
SCRIPT_FORMAT.md   script format + an LLM prompt to generate scripts
```

## Headless smoke test

With the offline env (as set by `run_podcast.bat`):
```cmd
..\IrodoriTTS-offline\.venv\Scripts\python.exe -m server.smoke_test
```

## Troubleshooting

- **A change doesn't show** → restart the server, then refresh the browser.
- **"Port 7864 already in use"** (a stale server is running) → free it:
  ```powershell
  Get-NetTCPConnection -LocalPort 7864 -State Listen |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }
  ```
- **Generation is slow** → higher **Quality (steps)** is slower (≈ linear). Keep most
  lines lower and raise only the ones that need it.

## Notes

- Keeping both Base v3 + VoiceDesign resident uses ~4 GB VRAM; models load lazily on
  first use and can be released via the backend (`POST /api/models/free`).
- Upstream SilentCipher watermarking is skipped in offline mode (as in the base
  distribution).
