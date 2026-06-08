/* StudioParts.jsx — LineCard, EmotionPopover, AutoTextarea, PlayerDock */

function AutoTextarea({ value, onChange, idx }) {
  const ref = React.useRef(null);
  const resize = () => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto"; el.style.height = el.scrollHeight + "px";
  };
  React.useLayoutEffect(resize, [value]);
  return (
    <textarea
      ref={ref} className="line-text" data-spk={idx} rows={1} value={value}
      spellCheck={false}
      style={{ resize: "none", width: "100%", fontFamily: "var(--font-ui)", display: "block", overflow: "hidden", minHeight: 0 }}
      onChange={(e) => { onChange(e.target.value); resize(); }}
    />
  );
}

function EmotionPopover({ current, inherit, onPick, onClose }) {
  const T = window.tr;
  React.useEffect(() => {
    const h = (e) => { if (!e.target.closest(".emo-pop") && !e.target.closest(".line-emotion")) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="emo-pop card" style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30,
      padding: 14, width: 248, boxShadow: "var(--shadow-lg)",
    }}>
      <div className="side-label" style={{ marginBottom: 10, fontSize: 11 }}>{T("moodForLine")}</div>
      <div className="emoji-grid">
        {window.EMOTIONS.map((e) => (
          <button key={e.id} className={"emoji-btn" + (current === e.id && !inherit ? " on" : "")}
            title={window.emoLabel(e.id)} onClick={() => { onPick(e.id); onClose(); }}>{e.em}</button>
        ))}
        <button className={"emoji-btn" + (current === "none" ? " on" : "")}
          title={T("emo_none")} onClick={() => { onPick("none"); onClose(); }}>🚫</button>
      </div>
      <button className="char-chip" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
        onClick={() => { onPick(null); onClose(); }}>
        ↺ {T("matchSpeaker")}
      </button>
    </div>
  );
}

function LineCard({ line, sp, emo, inherit, playing, preview, onPreview, onRegen, onEdit, onEmotion, onConfig, configOpen, children }) {
  const T = window.tr;
  const [popOpen, setPopOpen] = React.useState(false);
  const st = line.status;
  return (
    <div className={"line-card" + (playing ? " playing" : "")} data-spk={sp.idx}>
      <div className="gutter">
        <Avatar idx={sp.idx} face={sp.face} size="md" ring={playing} />
        <div className="sp-name">{sp.name}</div>
      </div>

      <div className="line-body">
        <div className="line-top">
          <div style={{ position: "relative" }}>
            <button className="line-emotion" data-spk={sp.idx} onClick={() => setPopOpen((o) => !o)}>
              <span className="em">{emo.em}</span>
              {inherit ? <span style={{ opacity: .7 }}>{T("auto")}</span> : window.emoLabel(emo.id)}
            </button>
            {popOpen && (
              <EmotionPopover current={line.emotion} inherit={inherit}
                onPick={onEmotion} onClose={() => setPopOpen(false)} />
            )}
          </div>

          {st === "ready" && <span className="line-status ready" data-spk={sp.idx}>✓ {T("statusReady")}</span>}
          {st === "gen" && <span className="line-status gen"><span className="spin" /> {T("statusGen")}</span>}
          {st === "edited" && <span className="line-status edited">● {T("statusEdited")}</span>}
          {st === "idle" && <span className="line-status idle">{T("statusIdle")}</span>}

          <span className="grow" />

          <div className="line-tools">
            <button className="tool play" data-spk={sp.idx} onClick={onPreview}>
              {preview ? <MiniWave idx={sp.idx} /> : <>▶ {T("preview")}</>}
            </button>
            <button className="tool" onClick={onRegen} title={T("regenTitle")}>↻ {T("regenerate")}</button>
            {onConfig && (
              <button className={"tool" + (configOpen ? " on" : "")} onClick={onConfig} title={T("lineSettings")}>⚙</button>
            )}
          </div>
        </div>

        <AutoTextarea idx={sp.idx} value={line.text} onChange={onEdit} />
        {children}
      </div>
    </div>
  );
}

function PlayerDock({ playing, onToggle, line, sp, elapsed, total, onDownload, exporting }) {
  const T = window.tr;
  const BARS = 72;
  const profile = React.useMemo(
    () => Array.from({ length: BARS }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.5) * 0.3) * 0.75),
    []
  );
  const prog = total > 0 ? elapsed / total : 0;
  const lit = Math.round(prog * BARS);
  const emo = sp ? window.emotionById(line.emotion || sp.emotion) : null;
  return (
    <div className="player">
      <button className="play-big" onClick={onToggle}>{playing ? "❚❚" : "▶"}</button>
      <div className="now">
        <div className="lbl">{playing ? T("nowPlaying") : T("fullPodcast")}</div>
        <div className="who">
          {sp ? <><span>{emo.em}</span> {sp.name}</> : <span style={{ opacity: .7 }}>{T("pressPlay")}</span>}
        </div>
      </div>
      <div className="wave">
        {profile.map((h, i) => (
          <i key={i} className={i < lit ? "on" : ""}
            style={{ height: Math.round(h * 34) + "px", background: sp && i < lit ? "var(--spk)" : undefined }}
            data-spk={sp ? sp.idx : 0} />
        ))}
      </div>
      <div className="time">{window.fmtTime(elapsed)} / {window.fmtTime(total)}</div>
      <button className="btn dl" onClick={onDownload} disabled={exporting}>
        {exporting ? "⏳" : "⬇"} WAV
      </button>
    </div>
  );
}

Object.assign(window, { LineCard, EmotionPopover, AutoTextarea, PlayerDock });
