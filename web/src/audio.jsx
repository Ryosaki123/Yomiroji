/* audio.jsx — real audio playback for the local backend.
   Replaces the former Web-Audio babble stub. Plays WAVs produced by Irodori TTS,
   synthesizing on demand for previews. Keeps the window.VoiceSynth interface
   (play/stop) the screens already call. */

(function () {
  let el = null;
  let token = 0; // invalidates stale onEnd callbacks

  function audioEl() {
    if (!el) el = new Audio();
    return el;
  }

  function stop() {
    token++;
    if (el) {
      try { el.pause(); } catch (e) {}
      el.removeAttribute("src");
      try { el.load(); } catch (e) {}
    }
  }

  // Play a WAV URL. Fires onEnd when playback ends (or errors).
  function playUrl(url, onEnd) {
    stop();
    const my = ++token;
    const a = audioEl();
    a.src = url;
    const finish = () => { if (my === token && onEnd) onEnd(); };
    a.onended = finish;
    a.onerror = finish;
    const p = a.play();
    if (p && p.catch) p.catch(() => finish());
    return a;
  }

  // play(opts): either { wavUrl } (play it) or a synth spec
  // { text, voiceId, pace, cfg_scale_speaker, mood, lang } -> synth then play.
  async function play(opts) {
    opts = opts || {};
    if (opts.wavUrl) return playUrl(opts.wavUrl, opts.onEnd);
    if (!opts.voiceId || !opts.text) { if (opts.onEnd) opts.onEnd(); return null; }
    const my = ++token;
    try {
      const res = await window.Api.synthLine({
        sessionId: opts.sessionId || "preview",
        lineId: "preview_" + (opts.lineId || "x"),
        text: opts.text,
        voiceId: opts.voiceId,
        pace: opts.pace != null ? opts.pace : 1.0,
        cfg_scale_speaker: opts.cfg_scale_speaker != null ? opts.cfg_scale_speaker : 5.0,
        num_steps: opts.num_steps != null ? opts.num_steps : 32,
        mood: opts.mood || null,
        lang: opts.lang || "ja",
      });
      if (my !== token) return null; // superseded by a newer call
      return playUrl(res.wavUrl, opts.onEnd);
    } catch (e) {
      if (window.__toast) window.__toast(String(e.message || e));
      if (opts.onEnd) opts.onEnd();
      return null;
    }
  }

  window.VoiceSynth = { play, playUrl, stop, audioEl };
})();
