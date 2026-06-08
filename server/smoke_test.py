"""Headless end-to-end smoke test of the TTS pipeline (no HTTP server).

Run with the offline venv + env (see run_podcast.bat), from the project root:
    python -m server.smoke_test
Exercises: auto voice -> save profile -> synth 2 lines -> stitch -> transcript.
"""
from __future__ import annotations

import sys
from pathlib import Path

from . import stitch, transcript, voicedesign, voices
from .paths import OUTPUTS_DIR, PREVIEWS_DIR
from .synth import synth_line


def main() -> int:
    print("[smoke] creating an auto voice...")
    prev = PREVIEWS_DIR / "smoke_preview.wav"
    voicedesign.auto_voice(out_path=str(prev), seed=42, lang="ja", num_steps=24)
    assert prev.is_file() and prev.stat().st_size > 1000, "preview wav not written"

    profile = {
        "id": "vsmoke", "name": "Smoke", "desc": "test", "face": "🧪",
        "language": "ja", "source": "auto", "seed": 42,
        "pace": 1.0, "cfg_scale_speaker": 5.0, "num_steps": 24, "builtin": False,
    }
    saved = voices.save(profile, str(prev))
    assert voices.exists("vsmoke"), "voice not saved"
    print("[smoke] voice saved ->", saved["ref_wav"])

    sess = OUTPUTS_DIR / "smoke"
    sess.mkdir(parents=True, exist_ok=True)
    lines = [
        {"lineId": "L0", "speaker": "Smoke", "text": "こんにちは。これはテストです。", "pauseAfter": 0.4},
        {"lineId": "L1", "speaker": "Smoke", "text": "二行目もちゃんと生成されます。", "pauseAfter": 0.3},
    ]
    segs = []
    for ln in lines:
        out = sess / f"seg_{ln['lineId']}.wav"
        info = synth_line(
            text=ln["text"], ref_wav=saved["ref_wav"], out_path=str(out), seed=42,
            pace=1.0, cfg_scale_speaker=5.0, num_steps=24, lang="ja",
        )
        print(f"[smoke] line {ln['lineId']} dur={info['duration']}s")
        assert out.is_file() and info["duration"] > 0.2
        segs.append({**ln, "wav": str(out)})

    podcast = sess / "podcast.wav"
    info = stitch.stitch(segs, str(podcast))
    files = transcript.write_all(info["segments"], str(sess / "podcast"), with_speaker=True,
                                 meta={"title": "smoke", "duration": info["duration"]})
    print("[smoke] podcast:", podcast, info["duration"], "s @", info["sample_rate"], "Hz")

    assert podcast.is_file()
    for k in ("srt", "vtt", "json"):
        assert Path(files[k]).is_file(), f"missing {k}"
    last_end = info["segments"][-1]["end"]
    assert abs(last_end - info["duration"]) < 0.5, f"transcript end {last_end} != audio {info['duration']}"
    starts = [s["start"] for s in info["segments"]]
    assert starts == sorted(starts), "timestamps not monotonic"
    print("[smoke] PASS - outputs in", sess)
    return 0


if __name__ == "__main__":
    sys.exit(main())
