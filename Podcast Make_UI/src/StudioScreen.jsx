/* StudioScreen.jsx — line-by-line editing, preview, regenerate, full-podcast player, WAV export */

const PAUSE_STEPS = [0.2, 0.4, 0.7, 1.0, 1.5];

function resolveLine(line, sp) {
  return {
    pitch: sp.pitch, speed: sp.speed,
    emotion: line.emotion || sp.emotion,
    seed: sp.idx, dur: line.dur, pauseAfter: line.pauseAfter,
    model: sp.model,
  };
}

function StudioScreen({ lines, setLines, speakers, onBack, onToast }) {
  const T = window.tr;
  const speakerOf = (l) => speakers[l.spk] || speakers[0];

  // ---- single-line preview ----
  const [previewId, setPreviewId] = React.useState(null);
  const previewLine = (line) => {
    const sp = speakerOf(line);
    setPreviewId(line.id);
    window.VoiceSynth.play({
      ...resolveLine(line, sp),
      onEnd: () => setPreviewId((p) => (p === line.id ? null : p)),
    });
  };

  // ---- per-line regenerate ----
  const setStatus = (id, status) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  const regenTimers = React.useRef({});
  const regenerate = (line) => {
    setStatus(line.id, "gen");
    clearTimeout(regenTimers.current[line.id]);
    regenTimers.current[line.id] = setTimeout(() => {
      setStatus(line.id, "ready");
      previewLine(line);
    }, 650 + Math.random() * 500);
  };

  // ---- edit text ----
  const editText = (id, text) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text, dur: window.estimateDur(text), status: "edited" } : l)));

  const setEmotion = (id, emotion) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, emotion, status: l.status === "ready" ? "edited" : l.status } : l)));

  const cyclePause = (id) =>
    setLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const i = PAUSE_STEPS.indexOf(l.pauseAfter);
      return { ...l, pauseAfter: PAUSE_STEPS[(i + 1) % PAUSE_STEPS.length] };
    }));

  // ---- generate all ----
  const [genProg, setGenProg] = React.useState(null); // 0..1 or null
  const genAll = () => {
    const pending = lines.filter((l) => l.status !== "ready");
    if (!pending.length) { onToast(T("toastAllReady")); return; }
    setLines((prev) => prev.map((l) => (l.status !== "ready" ? { ...l, status: "gen" } : l)));
    let done = 0;
    const queue = lines.map((l) => l.id);
    const tick = (i) => {
      if (i >= queue.length) { setGenProg(null); onToast(T("toastGenerated")); return; }
      const id = queue[i];
      setTimeout(() => {
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, status: "ready" } : l)));
        done++; setGenProg(done / queue.length);
        tick(i + 1);
      }, 160 + Math.random() * 180);
    };
    setGenProg(0); tick(0);
  };

  // ---- sequential player ----
  const [playIdx, setPlayIdx] = React.useState(-1); // -1 = stopped
  const [elapsed, setElapsed] = React.useState(0);
  const playRef = React.useRef({ timer: 0, timeouts: [] });

  const seq = React.useMemo(() => lines.map((l) => {
    const sp = speakerOf(l);
    const r = resolveLine(l, sp);
    return { ...r, playDur: Math.max(0.5, r.dur / r.speed) };
  }), [lines, speakers]);

  const bounds = React.useMemo(() => {
    let acc = 0;
    return seq.map((s) => {
      const b = { start: acc, end: acc + s.playDur + s.pauseAfter };
      acc = b.end; return b;
    });
  }, [seq]);
  const totalDur = bounds.length ? bounds[bounds.length - 1].end : 0;

  const stopAll = () => {
    clearInterval(playRef.current.timer);
    playRef.current.timeouts.forEach(clearTimeout);
    playRef.current.timeouts = [];
    window.VoiceSynth.stop();
    setPlayIdx(-1);
  };

  const playFrom = (start) => {
    stopAll();
    const offset = bounds[start].start;
    // schedule each line's voice at its offset
    for (let i = start; i < lines.length; i++) {
      const delay = (bounds[i].start - offset) * 1000;
      const line = lines[i];
      const to = setTimeout(() => {
        const sp = speakerOf(line);
        window.VoiceSynth.play(resolveLine(line, sp));
      }, delay);
      playRef.current.timeouts.push(to);
    }
    const startWall = performance.now();
    setPlayIdx(start);
    setElapsed(offset);
    playRef.current.timer = setInterval(() => {
      const e = offset + (performance.now() - startWall) / 1000;
      if (e >= totalDur) { setElapsed(totalDur); stopAll(); return; }
      setElapsed(e);
      const idx = bounds.findIndex((b) => e >= b.start && e < b.end);
      if (idx >= 0) setPlayIdx(idx);
    }, 60);
  };

  React.useEffect(() => () => stopAll(), []);
  const playing = playIdx >= 0;
  const togglePlay = () => { if (playing) stopAll(); else playFrom(0); };

  // ---- download WAV ----
  const [exporting, setExporting] = React.useState(false);
  const allReady = lines.length > 0 && lines.every((l) => l.status === "ready");
  const download = async () => {
    setExporting(true);
    onToast(T("toastMixing"));
    try {
      const blob = await window.VoiceSynth.renderPodcast(seq);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "yapp-podcast.wav";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      onToast(T("toastSaved"));
    } catch (e) {
      onToast(T("toastExportErr"));
    }
    setExporting(false);
  };

  const readyCount = lines.filter((l) => l.status === "ready").length;

  return (
    <div className="col">
      <div className="page-head">
        <div className="eyebrow">{T("s3eyebrow")}</div>
        <h1 className="title">{T("s3title")}</h1>
        <p className="subtitle">{T("s3subtitle")}</p>
      </div>

      <div className="studio">
        <div className="lines">
          {lines.map((line, i) => {
            const sp = speakerOf(line);
            const emo = window.emotionById(line.emotion || sp.emotion);
            const isPlaying = playIdx === i;
            return (
              <React.Fragment key={line.id}>
                <LineCard
                  line={line} sp={sp} emo={emo} inherit={!line.emotion}
                  playing={isPlaying} preview={previewId === line.id}
                  onPreview={() => previewLine(line)}
                  onRegen={() => regenerate(line)}
                  onEdit={(t) => editText(line.id, t)}
                  onEmotion={(id) => setEmotion(line.id, id)}
                />
                {i < lines.length - 1 && (
                  <div className="pause-tick">
                    <span className="ln" />
                    <button onClick={() => cyclePause(line.id)} title={T("pauseTitle")}>
                      ⏸ {line.pauseAfter.toFixed(1)}s
                    </button>
                    <span className="ln" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* side rail */}
        <aside className="rail">
          <div className="rail-card">
            <div className="side-label" style={{ marginBottom: 12 }}>{T("generate")}</div>
            {genProg === null ? (
              <Btn kind="primary" ic="✨" onClick={genAll} style={{ width: "100%" }}>
                {T("generateAll")}
              </Btn>
            ) : (
              <>
                <div className="gen-bar"><i style={{ width: Math.round(genProg * 100) + "%" }} /></div>
                <p className="muted" style={{ fontSize: 12.5, margin: "9px 0 0", fontFamily: "var(--font-mono)" }}>
                  {T("rendering")} {Math.round(genProg * 100)}%
                </p>
              </>
            )}
            <div className="row between" style={{ marginTop: 14, fontSize: 13 }}>
              <span className="muted">{T("statusReady")}</span>
              <b>{readyCount} / {lines.length}</b>
            </div>
            <div className="gen-bar" style={{ marginTop: 8 }}>
              <i style={{ width: (lines.length ? readyCount / lines.length * 100 : 0) + "%", background: "var(--ok)" }} />
            </div>
          </div>

          <div className="rail-card">
            <div className="side-label" style={{ marginBottom: 6 }}>{T("cast")}</div>
            {speakers.map((sp) => {
              const vl = window.voiceLangById(sp.lang);
              return (
              <div className="cast-mini" key={sp.id} data-spk={sp.idx}>
                <Avatar idx={sp.idx} face={sp.face} size="sm" />
                <div className="grow">
                  <div className="nm">{sp.name}</div>
                  <div className="vc">{(window.MODELS.find((m) => m.id === sp.model) || {}).name} · {vl.flag}{vl.short}</div>
                </div>
                <span style={{ fontSize: 16 }}>{window.emotionById(sp.emotion).em}</span>
              </div>
            ); })}
            <hr className="hr" />
            <div className="row between" style={{ fontSize: 13 }}>
              <span className="muted">{T("length")}</span><b>{window.fmtTime(totalDur)}</b>
            </div>
          </div>

          <div className="rail-card">
            <div className="side-label" style={{ marginBottom: 10 }}>{T("exportLabel")}</div>
            <Btn kind={allReady ? "primary" : "ghost"} ic={exporting ? "⏳" : "⬇"} disabled={exporting}
              onClick={download} style={{ width: "100%" }}>
              {exporting ? T("mixing") : T("downloadWav")}
            </Btn>
            {!allReady && (
              <p className="muted" style={{ fontSize: 12, margin: "9px 0 0" }}>
                {T("exportTip")}
              </p>
            )}
          </div>
        </aside>
      </div>

      <div style={{ marginTop: 26 }}>
        <Btn kind="ghost" ic="←" onClick={() => { stopAll(); onBack(); }}>{T("backToCast")}</Btn>
      </div>

      {/* player dock */}
      <PlayerDock
        playing={playing} onToggle={togglePlay}
        line={playIdx >= 0 ? lines[playIdx] : null}
        sp={playIdx >= 0 ? speakerOf(lines[playIdx]) : null}
        elapsed={elapsed} total={totalDur}
        onDownload={download} exporting={exporting}
      />
    </div>
  );
}

window.StudioScreen = StudioScreen;
