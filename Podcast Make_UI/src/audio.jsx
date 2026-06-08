/* audio.jsx — playful "voice" synth.
   Not real TTS — a soft formant-ish babble modulated to mimic speech cadence,
   pitched per character. Shared voice builder powers both live preview and an
   offline render that encodes a real downloadable WAV. */

(function () {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function baseFreq(pitch, seed) {
    const root = 150 + ((seed || 0) % 3) * 18;
    return root * Math.pow(2, (pitch || 0) / 12);
  }

  const FLAVOR = {
    excited:  { rate: 6.2, depth: 0.55, bright: 1.5 },
    playful:  { rate: 5.4, depth: 0.5,  bright: 1.3 },
    surprise: { rate: 6.6, depth: 0.6,  bright: 1.6 },
    curious:  { rate: 4.8, depth: 0.42, bright: 1.2 },
    neutral:  { rate: 4.6, depth: 0.38, bright: 1.0 },
    warm:     { rate: 4.2, depth: 0.4,  bright: 0.95 },
    calm:     { rate: 3.6, depth: 0.32, bright: 0.8 },
    serious:  { rate: 3.9, depth: 0.3,  bright: 0.85 },
    whisper:  { rate: 4.4, depth: 0.5,  bright: 1.1 },
    sad:      { rate: 3.2, depth: 0.45, bright: 0.7 },
  };

  // Build one spoken "line" into `a` (any AudioContext), connected to `dest`,
  // starting at time t0. Returns { nodes, dur }.
  function buildVoice(a, dest, opts, t0) {
    const speed = opts.speed || 1;
    const dur = Math.max(0.5, (opts.dur || 1.5) / speed);
    const fl = FLAVOR[opts.emotion] || FLAVOR.neutral;
    const isWhisper = opts.emotion === "whisper";
    const f0 = baseFreq(opts.pitch, opts.seed);

    // master env -> tremolo -> dest
    const master = a.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.linearRampToValueAtTime(isWhisper ? 0.05 : 0.085, t0 + 0.05);
    master.gain.setValueAtTime(isWhisper ? 0.05 : 0.085, t0 + dur - 0.09);
    master.gain.linearRampToValueAtTime(0.0001, t0 + dur);

    const trem = a.createGain();
    trem.gain.setValueAtTime(1 - fl.depth, t0);
    master.connect(trem);
    trem.connect(dest);

    const oscs = [];
    [{ mul: 1, type: "sawtooth", g: 0.6 }, { mul: 2.0, type: "triangle", g: 0.3 }].forEach((p) => {
      const o = a.createOscillator();
      o.type = p.type;
      const startF = f0 * p.mul;
      o.frequency.setValueAtTime(startF, t0);
      const rise = (opts.emotion === "curious" || opts.emotion === "surprise") ? 1.16 : 0.92;
      o.frequency.linearRampToValueAtTime(startF * 0.98, t0 + dur * 0.6);
      o.frequency.linearRampToValueAtTime(startF * rise, t0 + dur);
      const bp = a.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = (650 + 500 * fl.bright) * p.mul * 0.5;
      bp.Q.value = 6;
      const g = a.createGain();
      g.gain.value = p.g;
      o.connect(bp); bp.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur);
      oscs.push(o);
    });

    // breath noise
    const len = Math.ceil(a.sampleRate * dur);
    const nb = a.createBuffer(1, len, a.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.6;
    const noise = a.createBufferSource();
    noise.buffer = nb;
    const nf = a.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.value = 1800; nf.Q.value = 0.8;
    const ng = a.createGain();
    ng.gain.value = isWhisper ? 0.5 : 0.12;
    noise.connect(nf); nf.connect(ng); ng.connect(master);
    noise.start(t0); noise.stop(t0 + dur);

    // syllable tremolo LFO
    const lfo = a.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = fl.rate * speed;
    const lfoGain = a.createGain();
    lfoGain.gain.value = fl.depth;
    lfo.connect(lfoGain);
    lfoGain.connect(trem.gain);
    lfo.start(t0); lfo.stop(t0 + dur);

    return { nodes: [...oscs, noise, lfo], master, dur };
  }

  let current = null;
  function stop() { if (current) { try { current.stop(); } catch (e) {} current = null; } }

  // live single-line preview
  function play(opts) {
    stop();
    const a = ac();
    const t0 = a.currentTime + 0.02;
    const v = buildVoice(a, a.destination, opts, t0);
    let ended = false;
    const finish = () => { if (ended) return; ended = true; current = null; if (opts.onEnd) opts.onEnd(); };
    const timer = setTimeout(finish, v.dur * 1000 + 80);
    v.nodes[0].onended = finish;
    current = { stop() { clearTimeout(timer); try { v.nodes.forEach((n) => n.stop()); } catch (e) {} } };
    return v.dur;
  }

  // Offline render of the whole podcast -> WAV Blob.
  // seq: [{ pitch, speed, emotion, seed, dur, pauseAfter }]
  async function renderPodcast(seq, onProgress) {
    const sr = 44100;
    let total = 0.4;
    seq.forEach((s) => { total += Math.max(0.5, (s.dur || 1.5) / (s.speed || 1)) + (s.pauseAfter || 0); });
    const off = new OfflineAudioContext(1, Math.ceil(sr * total), sr);
    const mix = off.createGain();
    mix.gain.value = 0.9;
    mix.connect(off.destination);
    let t = 0.2;
    seq.forEach((s, i) => {
      const v = buildVoice(off, mix, s, t);
      t += v.dur + (s.pauseAfter || 0);
      if (onProgress) onProgress((i + 1) / seq.length);
    });
    const buf = await off.startRendering();
    return encodeWav(buf);
  }

  function encodeWav(buf) {
    const ch = buf.getChannelData(0);
    const n = ch.length;
    const ab = new ArrayBuffer(44 + n * 2);
    const dv = new DataView(ab);
    const wr = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
    wr(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); wr(8, "WAVE");
    wr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, 44100, true);
    dv.setUint32(28, 44100 * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wr(36, "data"); dv.setUint32(40, n * 2, true);
    let o = 44;
    for (let i = 0; i < n; i++) {
      let v = Math.max(-1, Math.min(1, ch[i]));
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
    return new Blob([ab], { type: "audio/wav" });
  }

  window.VoiceSynth = { play, stop, ac, renderPodcast };
})();
