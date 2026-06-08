"""Local FastAPI backend for the Podcast Maker. Serves the React SPA and exposes
Irodori-TTS as REST. Fully offline; no external calls.

Launch:  uvicorn server.main:app --host 127.0.0.1 --port 7864
(env IRODORI_TTS_MODELS_DIR / HF_HUB_OFFLINE / PYTHONPATH set by run_podcast.bat)
"""
from __future__ import annotations

import base64
import secrets
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from . import editor, runtime_pool, stitch, transcript, voicedesign, voices
from .paths import DATA_DIR, OUTPUTS_DIR, PREVIEWS_DIR, VOICES_DIR, WEB_DIR
from .synth import synth_line

app = FastAPI(title="Podcast Maker — Irodori TTS")


@app.middleware("http")
async def _no_store(request, call_next):
    # Local dev app: never cache JS/HTML so edits always load on refresh.
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store, must-revalidate"
    return resp

MODELS = [
    {"id": "base", "name": "Irodori Base v3", "role": "render", "note": "voice cloning, auto length"},
    {"id": "voicedesign", "name": "Irodori VoiceDesign", "role": "design", "note": "design a voice from a prompt"},
]


# ---------- helpers ----------
def _media_url(path: str | Path) -> str:
    rel = Path(path).resolve().relative_to(DATA_DIR.resolve())
    return "/media/" + str(rel).replace("\\", "/")


def _rand_seed() -> int:
    return int(secrets.randbits(31))


def _decode_upload_to_wav(audio_b64: str, filename: str, out_wav: Path) -> None:
    raw = base64.b64decode(audio_b64.split(",")[-1])
    tmp = out_wav.with_suffix(Path(filename or "ref").suffix or ".bin")
    tmp.write_bytes(raw)
    import torch
    import torchaudio

    from irodori_tts.inference_runtime import save_wav

    try:
        wav, sr = torchaudio.load(str(tmp))
    except Exception:
        import soundfile as sf

        data, sr = sf.read(str(tmp), dtype="float32", always_2d=True)
        wav = torch.from_numpy(data.T)
    if wav.ndim == 1:
        wav = wav.unsqueeze(0)
    if wav.shape[0] > 1:
        wav = wav.mean(dim=0, keepdim=True)
    save_wav(out_wav, wav.to(dtype=torch.float32), int(sr))
    try:
        tmp.unlink()
    except Exception:
        pass


# ---------- request models ----------
class PreviewReq(BaseModel):
    source: str = "design"           # design | auto | upload
    caption: str | None = None
    lang: str = "ja"
    seed: int | None = None
    num_steps: int = 45
    sample_text: str | None = None
    audio_b64: str | None = None     # for source=upload
    filename: str | None = None


class SaveVoiceReq(BaseModel):
    previewId: str | None = None
    fromVoiceId: str | None = None    # duplicate an existing voice's reference WAV
    name: str
    desc: str = ""
    face: str = "🎙️"
    lang: str = "ja"
    source: str = "design"
    caption: str | None = None
    seed: int | None = None
    pace: float = 1.0
    cfg_scale_speaker: float = 5.0
    num_steps: int = 45


class UpdateVoiceReq(BaseModel):
    name: str | None = None
    desc: str | None = None
    face: str | None = None
    language: str | None = None
    pace: float | None = None
    cfg_scale_speaker: float | None = None
    num_steps: int | None = None
    seed: int | None = None
    emotion: str | None = None


class LineSynthReq(BaseModel):
    sessionId: str = "default"
    lineId: str
    text: str
    voiceId: str
    pace: float = 1.0
    cfg_scale_speaker: float = 5.0
    num_steps: int = 45
    seed: int | None = None
    mood: str | None = None
    lang: str = "ja"


class RenderLine(BaseModel):
    lineId: str
    speaker: str = ""
    text: str
    voiceId: str
    pace: float = 1.0
    cfg_scale_speaker: float = 5.0
    num_steps: int = 45
    seed: int | None = None
    mood: str | None = None
    lang: str = "ja"
    pauseAfter: float = 0.2


class RenderReq(BaseModel):
    sessionId: str = "default"
    title: str = "podcast"
    withSpeaker: bool = True
    force: bool = False
    lines: list[RenderLine]
    # final-output settings
    tempo: float = 1.0          # pitch-preserving speed (>1 faster)
    gap_scale: float = 1.0      # multiplies every per-line pause
    lead_in: float = 0.2        # silence before the first line (s)
    peak: float = 0.97          # normalization peak (0-1)


class LineEditReq(BaseModel):
    sessionId: str = "default"
    lineId: str
    start: float
    end: float
    op: str = "cut"


# ---------- API ----------
@app.get("/api/health")
def health() -> dict:
    return {"ok": True, **runtime_pool.device_info()}


@app.get("/api/models")
def get_models() -> dict:
    return {"models": MODELS, **runtime_pool.device_info()}


@app.get("/api/voices")
def get_voices() -> dict:
    out = []
    for v in voices.list_voices():
        out.append({**v, "wavUrl": _media_url(v["ref_wav"]) if v.get("ref_wav") else None})
    return {"voices": out}


@app.post("/api/voice/preview")
async def voice_preview(req: PreviewReq) -> dict:
    preview_id = "p" + secrets.token_hex(8)
    out = PREVIEWS_DIR / f"{preview_id}.wav"
    seed = req.seed if req.seed is not None else _rand_seed()
    src = (req.source or "design").lower()

    if src == "upload":
        if not req.audio_b64:
            raise HTTPException(400, "audio_b64 required for upload.")
        await run_in_threadpool(_decode_upload_to_wav, req.audio_b64, req.filename or "ref.wav", out)
        info = {"duration": None, "sample_rate": None}
    elif src == "auto":
        info = await run_in_threadpool(
            voicedesign.auto_voice,
            out_path=str(out), seed=seed, lang=req.lang,
            num_steps=req.num_steps, sample_text=req.sample_text,
        )
    else:
        info = await run_in_threadpool(
            voicedesign.design_voice,
            out_path=str(out), caption=req.caption or "", seed=seed, lang=req.lang,
            num_steps=req.num_steps, sample_text=req.sample_text,
        )
    return {"previewId": preview_id, "wavUrl": _media_url(out), "seed": seed, **info}


@app.post("/api/voices")
def save_voice(req: SaveVoiceReq) -> dict:
    if req.fromVoiceId:
        if not voices.exists(req.fromVoiceId):
            raise HTTPException(404, f"Source voice not found: {req.fromVoiceId}")
        source_wav = Path(voices.load(req.fromVoiceId)["ref_wav"])
    else:
        source_wav = PREVIEWS_DIR / f"{req.previewId}.wav"
        if not source_wav.is_file():
            raise HTTPException(404, "Preview not found (regenerate the voice).")
    preview = source_wav
    vid = "v" + secrets.token_hex(8)
    profile = {
        "id": vid, "name": req.name, "desc": req.desc, "face": req.face,
        "language": req.lang, "source": req.source, "caption": req.caption,
        "seed": req.seed if req.seed is not None else _rand_seed(),
        "pace": req.pace, "cfg_scale_speaker": req.cfg_scale_speaker,
        "num_steps": req.num_steps, "builtin": False,
    }
    saved = voices.save(profile, str(preview))
    return {"voice": {**saved, "wavUrl": _media_url(saved["ref_wav"])}}


@app.patch("/api/voices/{vid}")
def update_voice(vid: str, req: UpdateVoiceReq) -> dict:
    if not voices.exists(vid):
        raise HTTPException(404, f"Voice not found: {vid}")
    patch = {k: v for k, v in req.dict().items() if v is not None}
    saved = voices.update(vid, patch)
    return {"voice": {**saved, "wavUrl": _media_url(saved["ref_wav"])}}


@app.delete("/api/voices/{vid}")
def delete_voice(vid: str) -> dict:
    return {"deleted": voices.delete(vid)}


@app.post("/api/line/synth")
async def line_synth(req: LineSynthReq) -> dict:
    if not voices.exists(req.voiceId):
        raise HTTPException(404, f"Voice not found: {req.voiceId}")
    profile = voices.load(req.voiceId)
    seed = req.seed if req.seed is not None else int(profile.get("seed") or _rand_seed())
    out_dir = OUTPUTS_DIR / req.sessionId
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"seg_{req.lineId}.wav"
    info = await run_in_threadpool(
        synth_line,
        text=req.text, ref_wav=profile["ref_wav"], out_path=str(out), seed=seed,
        pace=req.pace, cfg_scale_speaker=req.cfg_scale_speaker, num_steps=req.num_steps,
        lang=req.lang, mood=req.mood,
    )
    return {"wavUrl": _media_url(out) + f"?t={int(time.time())}", "duration": info["duration"], "seed": seed}


def _render_blocking(req: RenderReq) -> dict:
    out_dir = OUTPUTS_DIR / req.sessionId
    out_dir.mkdir(parents=True, exist_ok=True)
    segments = []
    for ln in req.lines:
        if not voices.exists(ln.voiceId):
            raise ValueError(f"Voice not found: {ln.voiceId} (line {ln.lineId})")
        profile = voices.load(ln.voiceId)
        seg = out_dir / f"seg_{ln.lineId}.wav"
        if req.force or not seg.is_file():
            seed = ln.seed if ln.seed is not None else int(profile.get("seed") or _rand_seed())
            synth_line(
                text=ln.text, ref_wav=profile["ref_wav"], out_path=str(seg), seed=seed,
                pace=ln.pace, cfg_scale_speaker=ln.cfg_scale_speaker, num_steps=ln.num_steps,
                lang=ln.lang, mood=ln.mood,
            )
        segments.append(
            {"speaker": ln.speaker, "text": ln.text, "wav": str(seg), "pauseAfter": ln.pauseAfter}
        )

    podcast = out_dir / "podcast.wav"
    info = stitch.stitch(
        segments, str(podcast),
        lead_in_s=req.lead_in, peak=req.peak, gap_scale=req.gap_scale, tempo=req.tempo,
    )
    stem = str(out_dir / "podcast")
    files = transcript.write_all(
        info["segments"], stem, with_speaker=req.withSpeaker,
        meta={"title": req.title, "sample_rate": info["sample_rate"], "duration": info["duration"], "wav": "podcast.wav"},
    )
    return {
        "wavUrl": _media_url(podcast) + f"?t={int(time.time())}",
        "srtUrl": _media_url(files["srt"]),
        "vttUrl": _media_url(files["vtt"]),
        "jsonUrl": _media_url(files["json"]),
        "duration": info["duration"],
        "segments": info["segments"],
    }


@app.post("/api/podcast/render")
async def podcast_render(req: RenderReq) -> dict:
    if not req.lines:
        raise HTTPException(400, "No lines to render.")
    return await run_in_threadpool(_render_blocking, req)


@app.post("/api/line/edit")
async def line_edit(req: LineEditReq) -> dict:
    seg = OUTPUTS_DIR / req.sessionId / f"seg_{req.lineId}.wav"
    if not seg.is_file():
        raise HTTPException(404, "Line audio not found; generate it first.")
    info = await run_in_threadpool(editor.edit_line, str(seg), str(seg), req.start, req.end, req.op)
    return {"wavUrl": _media_url(seg) + f"?t={int(time.time())}", "duration": info["duration"]}


@app.post("/api/models/free")
def free_models() -> dict:
    return {"freed": runtime_pool.free_all()}


@app.exception_handler(Exception)
async def _unhandled(_request, exc):  # surface backend errors to the UI
    return JSONResponse(status_code=500, content={"error": str(exc)})


# ---------- static (mounted last so /api wins) ----------
app.mount("/media", StaticFiles(directory=str(DATA_DIR)), name="media")
app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
