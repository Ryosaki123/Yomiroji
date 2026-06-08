# Yomiroji

🌐 **English** · [日本語](README.ja.md)

A fully local, offline podcast maker. Paste an LLM-written script with speaker tags,
give each speaker a distinct cloned voice, and render the whole conversation into
**one podcast WAV** plus a timestamped transcript (SRT / WebVTT / JSON) for syncing
with a video clip later.

It drives the Japanese **Irodori-TTS** engine and models (by **Aratako**, MIT-licensed),
which you install yourself — Yomiroji does **not** redistribute the model weights. Once
set up there is no API and no network at runtime. Primary audience is Japanese; English
is structurally supported (per-voice language).

It's a small **React single-page app** (`web/`) talking to a local **FastAPI backend**
(`server/`) that runs the TTS. The backend reuses the Irodori-TTS Python env, so there
are **no extra Python dependencies** of its own.

> **License:** Yomiroji is MIT ([LICENSE](LICENSE)). The Irodori-TTS code and all model
> weights are by Aratako and also MIT (commercial use permitted). Please follow the
> models' ethical-use note (no impersonation / deepfakes / misinformation). See
> [CREDITS.md](CREDITS.md).

---

## Prerequisites

- **Windows**, **Python 3.12.x** on PATH, and **git**.
- An **NVIDIA GPU with a CUDA 12.8 driver** is recommended. No GPU? It still runs on CPU
  (much slower) — install a CPU build of PyTorch instead (see step 2 notes).

## Setup

Run these from **Command Prompt (cmd)** in the folder where you want the project:

```cmd
:: 1. Get Yomiroji
git clone https://github.com/Ryosaki123/Yomiroji.git
cd Yomiroji

:: 2. Set up the Irodori-TTS engine + models (creates a sibling ..\IrodoriTTS-offline\)
::    Clones Aratako/Irodori-TTS (pinned commit), applies the offline patch, builds a
::    venv, and downloads the MIT models from Hugging Face. Needs internet; downloads
::    several GB (PyTorch + models). Double-clicking the .bat also works.
setup_irodori.bat

:: 3. Vendor the frontend libs/fonts locally (one-time, so the UI runs offline)
vendor_fetch.bat
```

> The `.bat` files just launch the matching `.ps1` in PowerShell with the execution
> policy bypassed. **Running `.\setup_irodori.ps1` directly in cmd does nothing** — use
> the `.bat`, or run the `.ps1` from a PowerShell window.
>
> CPU-only: after step 2, reinstall torch without CUDA, e.g.
> `..\IrodoriTTS-offline\.venv\Scripts\python -m pip install torch torchaudio` .

## Run

```cmd
run_podcast.bat
```
Then open <http://127.0.0.1:7864>. After setup it runs fully offline (Wi-Fi off is fine).

### Manual engine setup (if `setup_irodori.ps1` fails)

It just automates these, into a sibling `..\IrodoriTTS-offline\`:
1. `git clone https://github.com/Aratako/Irodori-TTS.git irodori-src` →
   `git checkout d2af4193ea172b4214433e72f24f3b0f13d2c1bd` →
   `git apply <Yomiroji>\setup\offline-local-patches.patch`
2. `python -m venv .venv`; install `setup/requirements.txt`
   (`--extra-index-url https://download.pytorch.org/whl/cu128`) and
   `pip install --no-deps -e irodori-src`
3. Download into `models\`: `Aratako/Irodori-TTS-500M-v3` →`base\model.safetensors`,
   `Aratako/Irodori-TTS-500M-v2-VoiceDesign` →`voicedesign\model.safetensors`,
   `Aratako/Semantic-DACVAE-Japanese-32dim` →`codec\weights.pth`, and the
   `llm-jp/llm-jp-3-150m` tokenizer files →`tokenizers\llm-jp__llm-jp-3-150m\`.

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

## License & credits

- **Yomiroji** (this repo): MIT — see [LICENSE](LICENSE).
- **Irodori-TTS** engine + models: © **Aratako**, MIT —
  <https://github.com/Aratako/Irodori-TTS>. Yomiroji does not redistribute the weights;
  `setup_irodori.ps1` downloads them from Hugging Face.
- Full attribution and the **ethical-use note** (no impersonation / deepfakes /
  misinformation) are in [CREDITS.md](CREDITS.md).
