# Credits & third-party licenses

**Yomiroji** (this repository) is the original work — a web UI + local backend that
drives a text-to-speech engine. It is released under the [MIT License](LICENSE).
Yomiroji does **not** include or redistribute any model weights; it depends on the
projects below, which you install yourself (see the README "Setup").

## Irodori-TTS (engine + models) — © Aratako, MIT

The speech engine and all model weights are by **Aratako** and licensed **MIT**
(commercial use permitted). Yomiroji calls its `irodori_tts` Python package.

- Code: <https://github.com/Aratako/Irodori-TTS> (pinned commit `d2af4193ea172b4214433e72f24f3b0f13d2c1bd`)
- Models (Hugging Face, MIT):
  - <https://huggingface.co/Aratako/Irodori-TTS-500M-v3> (Base v3 — voice cloning)
  - <https://huggingface.co/Aratako/Irodori-TTS-500M-v2-VoiceDesign> (design a voice from a prompt)
  - <https://huggingface.co/Aratako/Semantic-DACVAE-Japanese-32dim> (codec)
- Tokenizer: <https://huggingface.co/llm-jp/llm-jp-3-150m>

`setup/offline-local-patches.patch` is a small set of **offline-mode modifications**
to the Irodori-TTS source (local model paths via `IRODORI_TTS_MODELS_DIR`, skipping the
optional SilentCipher watermark when offline). It is a derivative of Aratako's MIT code;
the MIT copyright notice above applies to it as well.

### Ethical-use note (from the Irodori-TTS model cards)
Beyond the MIT license, the model authors ask that you **not**:
- impersonate real people's voices without their consent,
- create deepfakes or generate misinformation.

You are responsible for complying with applicable laws and these guidelines.

## Other dependencies
Installed via `setup/requirements.txt` / the Irodori-TTS project — each under its own
license (PyTorch/torchaudio: BSD-3; Hugging Face libraries: Apache-2.0; SilentCipher:
see its repository; etc.).

## Attribution
- Irodori-TTS and its models: **Aratako** — <https://github.com/Aratako/Irodori-TTS>
- Yomiroji UI/app: built by the repository owner with AI assistance.
