/* StudioScreen.jsx — line-by-line edit / preview / regenerate (with per-line
   settings and seed reroll), full-podcast player, output settings, and
   WAV + transcript export, all backed by the local Irodori backend. */

const PAUSE_STEPS = [0.2, 0.4, 0.7, 1.0, 1.5];
const randSeed = () => Math.floor(Math.random() * 2147483647);
const numOr = (v, d) => (v === null || v === undefined || v === "" ? d : v);

function StudioScreen({ lines, setLines, speakers, onBack, onToast, sessionId, title }) {
  const T = window.tr;
  const speakerOf = (l) => speakers[l.spk] || speakers[0];

  const [renderInfo, setRenderInfo] = React.useState(null);
  const [dirty, setDirty] = React.useState(true);
  const [configFor, setConfigFor] = React.useState(null); // line id with open settings
  const [output, setOutput] = React.useState({ tempo: 1.0, gap: 1.0, leadIn: 0.2, peak: 0.97 });
  const markDirty = () => { setDirty(true); setRenderInfo(null); };
  const setOut = (patch) => { setOutput((o) => ({ ...o, ...patch })); markDirty(); };

  const synthSpec = (line, extra) => {
    const sp = speakerOf(line);
    return {
      sessionId, lineId: line.id, text: line.text, voiceId: sp.voiceId,
      pace: numOr(line.pace, sp.speed),
      cfg_scale_speaker: numOr(line.cfg, sp.cfg),
      num_steps: numOr(line.steps, sp.steps),
      seed: line.seed != null ? line.seed : null,
      mood: line.emotion || sp.emotion, lang: sp.lang,
      ...(extra || {}),
    };
  };

  const setLine = (id, patch) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  // ---- single-line synth ----
  const synthOne = async (line, extra) => {
    const sp = speakerOf(line);
    if (!sp.voiceId) { onToast(T("assignVoiceFirst")); return null; }
    setLine(line.id, { status: "gen" });
    try {
      const r = await window.Api.synthLine(synthSpec(line, extra));
      // persist the seed actually used so the final render reproduces this take
      setLine(line.id, { status: "ready", wavUrl: r.wavUrl, dur: r.duration, seed: r.seed });
      markDirty();
      return r;
    } catch (e) {
      setLine(line.id, { status: "edited" });
      onToast(String(e.message || e));
      return null;
    }
  };

  // ---- preview ----
  const [previewId, setPreviewId] = React.useState(null);
  const previewLine = async (line) => {
    setPreviewId(line.id);
    const done = () => setPreviewId((p) => (p === line.id ? null : p));
    if (line.wavUrl && line.status === "ready") window.VoiceSynth.playUrl(line.wavUrl, done);
    else { const r = await synthOne(line); if (r) window.VoiceSynth.playUrl(r.wavUrl, done); else done(); }
  };

  // regenerate = a NEW take: reroll the seed each time
  const regenerate = (line) => { synthOne(line, { seed: randSeed() }); };

  // ---- edits ----
  const editText = (id, text) =>
    setLine(id, { text, dur: window.estimateDur(text), status: "edited", wavUrl: null });
  const setEmotion = (id, emotion) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, emotion, status: l.status === "ready" ? "edited" : l.status, wavUrl: null } : l)));
  const cyclePause = (id) =>
    setLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const i = PAUSE_STEPS.indexOf(l.pauseAfter);
      return { ...l, pauseAfter: PAUSE_STEPS[(i + 1) % PAUSE_STEPS.length] };
    }));
  // a per-line setting change marks the line for re-synth
  const setLineCfg = (id, patch) =>
    setLine(id, { ...patch, status: "edited", wavUrl: null });
  React.useEffect(() => { markDirty(); }, []);

  // ---- generate all (sequential, with progress) ----
  const [genProg, setGenProg] = React.useState(null);
  const ensureGenerated = async (withProgress) => {
    const pending = lines.filter((l) => l.status !== "ready" || !l.wavUrl);
    if (!pending.length) return true;
    let done = 0;
    if (withProgress) setGenProg(0);
    for (const line of pending) {
      const r = await synthOne(line);
      done++;
      if (withProgress) setGenProg(done / pending.length);
      if (!r) { if (withProgress) setGenProg(null); return false; }
    }
    if (withProgress) setGenProg(null);
    return true;
  };
  const genAll = async () => {
    const all = lines.length > 0 && lines.every((l) => l.status === "ready" && l.wavUrl);
    if (all) { onToast(T("toastAllReady")); return; }
    if (await ensureGenerated(true)) onToast(T("toastGenerated"));
  };
  // Force re-synthesis of EVERY line with the current voice settings (keeps each
  // line's seed, so it applies character/setting changes deterministically).
  const regenAll = async () => {
    if (!lines.length) return;
    setGenProg(0);
    let done = 0;
    for (const line of lines) {
      const r = await synthOne(line);
      done++;
      setGenProg(done / lines.length);
      if (!r) { setGenProg(null); return; }
    }
    setGenProg(null);
    onToast(T("toastGenerated"));
  };

  // ---- render / rebuild the final podcast ----
  const doRender = async () => {
    const body = {
      sessionId, title: title || "podcast", withSpeaker: true, force: false,
      tempo: output.tempo, gap_scale: output.gap, lead_in: output.leadIn, peak: output.peak,
      lines: lines.map((l) => {
        const sp = speakerOf(l);
        return {
          lineId: l.id, speaker: sp.name, text: l.text, voiceId: sp.voiceId,
          pace: numOr(l.pace, sp.speed), cfg_scale_speaker: numOr(l.cfg, sp.cfg),
          num_steps: numOr(l.steps, sp.steps), seed: l.seed != null ? l.seed : null,
          mood: l.emotion || sp.emotion, lang: sp.lang, pauseAfter: l.pauseAfter,
        };
      }),
    };
    const info = await window.Api.render(body);
    setRenderInfo(info); setDirty(false);
    return info;
  };
  const prepareMix = async () => {
    if (!(await ensureGenerated(true))) return null;
    if (renderInfo && !dirty) return renderInfo;
    return await doRender();
  };
  const [rebuilding, setRebuilding] = React.useState(false);
  const rebuild = async () => {
    setRebuilding(true);
    onToast(T("toastMixing"));
    try { if (await prepareMix()) onToast(T("toastBuilt")); }
    catch (e) { onToast(String(e.message || e)); }
    setRebuilding(false);
  };

  // ---- full-podcast player (single combined WAV) ----
  const [playing, setPlaying] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [playIdx, setPlayIdx] = React.useState(-1);
  const timerRef = React.useRef(0);
  const stopAll = () => { clearInterval(timerRef.current); window.VoiceSynth.stop(); setPlaying(false); setPlayIdx(-1); };
  React.useEffect(() => () => stopAll(), []);
  const togglePlay = async () => {
    if (playing) { stopAll(); return; }
    onToast(T("toastMixing"));
    const info = await prepareMix();
    if (!info) return;
    const a = window.VoiceSynth.audioEl();
    window.VoiceSynth.playUrl(info.wavUrl, () => stopAll());
    setPlaying(true);
    timerRef.current = setInterval(() => {
      const e = a.currentTime || 0;
      setElapsed(e);
      const idx = (info.segments || []).findIndex((s) => e >= s.start && e < s.end);
      if (idx >= 0) setPlayIdx(idx);
    }, 80);
  };

  // ---- export ----
  const [exporting, setExporting] = React.useState(false);
  const download = async () => {
    setExporting(true); onToast(T("toastMixing"));
    try {
      const info = await prepareMix();
      if (info) {
        const a = document.createElement("a");
        a.href = info.wavUrl; a.download = (title || "podcast") + ".wav";
        document.body.appendChild(a); a.click(); a.remove();
        onToast(T("toastSaved"));
      }
    } catch (e) { onToast(String(e.message || e)); }
    setExporting(false);
  };

  const readyCount = lines.filter((l) => l.status === "ready" && l.wavUrl).length;
  const totalDur = renderInfo ? renderInfo.duration : window.sessionLength(lines, speakers);
  const allReady = lines.length > 0 && readyCount === lines.length;

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
            return (
              <React.Fragment key={line.id}>
                <LineCard
                  line={line} sp={sp} emo={emo} inherit={!line.emotion}
                  playing={playIdx === i} preview={previewId === line.id}
                  onPreview={() => previewLine(line)}
                  onRegen={() => regenerate(line)}
                  onEdit={(t) => editText(line.id, t)}
                  onEmotion={(id) => setEmotion(line.id, id)}
                  onConfig={() => setConfigFor((c) => (c === line.id ? null : line.id))}
                  configOpen={configFor === line.id}
                >
                  {configFor === line.id && (
                    <LineSettings line={line} sp={sp}
                      onChange={(patch) => setLineCfg(line.id, patch)}
                      onReroll={() => setLineCfg(line.id, { seed: randSeed() })}
                      onReset={() => setLineCfg(line.id, { seed: null, pace: null, cfg: null, steps: null })} />
                  )}
                </LineCard>
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

        <aside className="rail">
          <div className="rail-card">
            <div className="side-label" style={{ marginBottom: 12 }}>{T("generate")}</div>
            {genProg === null ? (
              <>
                <Btn kind="primary" ic="✨" onClick={genAll} style={{ width: "100%" }}>{T("generateAll")}</Btn>
                <Btn kind="soft" ic="🔄" onClick={regenAll} title={T("regenAllTitle")}
                  disabled={!lines.length} style={{ width: "100%", marginTop: 8 }}>{T("regenerateAll")}</Btn>
              </>
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
                    <div className="vc">Irodori · {vl.flag}{vl.short}</div>
                  </div>
                  <span style={{ fontSize: 16 }}>{window.emotionById(sp.emotion).em}</span>
                </div>
              );
            })}
            <hr className="hr" />
            <div className="row between" style={{ fontSize: 13 }}>
              <span className="muted">{T("length")}</span><b>{window.fmtTime(totalDur)}</b>
            </div>
          </div>

          {/* final-output settings */}
          <div className="rail-card">
            <div className="side-label" style={{ marginBottom: 10 }}>{T("outputLabel")}</div>
            <OutputCtrl label={"⏩ " + T("tempo")} val={output.tempo.toFixed(2) + "×"}>
              <Slider idx={0} value={output.tempo} min={0.8} max={1.25} step={0.01}
                onChange={(v) => setOut({ tempo: v })} />
            </OutputCtrl>
            <OutputCtrl label={"⏮ " + T("leadIn")} val={output.leadIn.toFixed(2) + "s"}>
              <Slider idx={0} value={output.leadIn} min={0.0} max={1.5} step={0.05}
                onChange={(v) => setOut({ leadIn: v })} />
            </OutputCtrl>
            <OutputCtrl label={"🔊 " + T("peak")} val={Math.round(output.peak * 100) + "%"}>
              <Slider idx={0} value={output.peak} min={0.5} max={1.0} step={0.01}
                onChange={(v) => setOut({ peak: v })} />
            </OutputCtrl>
            <Btn kind="soft" ic={rebuilding ? "⏳" : "🔁"} disabled={rebuilding} onClick={rebuild}
              style={{ width: "100%", marginTop: 12 }}>
              {rebuilding ? T("mixing") : T("rebuildPodcast")}
            </Btn>
            {dirty && renderInfo === null && (
              <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>{T("rebuildHint")}</p>
            )}
          </div>

          <div className="rail-card">
            <div className="side-label" style={{ marginBottom: 10 }}>{T("exportLabel")}</div>
            <Btn kind={allReady ? "primary" : "ghost"} ic={exporting ? "⏳" : "⬇"} disabled={exporting}
              onClick={download} style={{ width: "100%" }}>
              {exporting ? T("mixing") : T("downloadWav")}
            </Btn>
            {renderInfo && (
              <>
                <div className="side-label" style={{ margin: "14px 0 8px", fontSize: 11 }}>{T("transcript")}</div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <a className="char-chip" href={renderInfo.srtUrl} download>{T("downloadSrt")}</a>
                  <a className="char-chip" href={renderInfo.vttUrl} download>{T("downloadVtt")}</a>
                  <a className="char-chip" href={renderInfo.jsonUrl} download>{T("downloadJson")}</a>
                </div>
              </>
            )}
            {!allReady && (
              <p className="muted" style={{ fontSize: 12, margin: "9px 0 0" }}>{T("exportTip")}</p>
            )}
          </div>
        </aside>
      </div>

      <div style={{ marginTop: 26 }}>
        <Btn kind="ghost" ic="←" onClick={() => { stopAll(); onBack(); }}>{T("backToCast")}</Btn>
      </div>

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

function OutputCtrl({ label, val, children }) {
  return (
    <div className="ctrl">
      <div className="ctrl-head">
        <span className="ctrl-label">{label}</span>
        <span className="ctrl-val">{val}</span>
      </div>
      {children}
    </div>
  );
}

// Per-line generation settings (override the speaker defaults for this line).
function LineSettings({ line, sp, onChange, onReroll, onReset }) {
  const T = window.tr;
  const pace = numOr(line.pace, sp.speed);
  const cfg = numOr(line.cfg, sp.cfg);
  const steps = numOr(line.steps, sp.steps);
  return (
    <div className="card pad" data-spk={sp.idx} style={{ marginTop: 10 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="side-label" style={{ fontSize: 11 }}>{T("lineSettings")}</span>
        <button className="char-chip" onClick={onReset}>↺ {T("resetDefaults")}</button>
      </div>
      <div className="ctrl-head"><span className="ctrl-label">🎭 {T("moodForLine")}</span></div>
      <div className="emoji-grid" style={{ marginBottom: 10 }}>
        {window.EMOTIONS.map((e) => (
          <button key={e.id} className={"emoji-btn" + (line.emotion === e.id ? " on" : "")} data-spk={sp.idx}
            title={window.emoLabel(e.id)} onClick={() => onChange({ emotion: e.id })}>{e.em}</button>
        ))}
        <button className={"emoji-btn" + (line.emotion === "none" ? " on" : "")} data-spk={sp.idx}
          title={T("emo_none")} onClick={() => onChange({ emotion: "none" })}>🚫</button>
        <button className={"emoji-btn" + (!line.emotion ? " on" : "")} data-spk={sp.idx}
          title={T("matchSpeaker")} onClick={() => onChange({ emotion: null })}>↺</button>
      </div>
      <div className="row" style={{ gap: 10, alignItems: "center", marginBottom: 6 }}>
        <span className="ctrl-label" style={{ minWidth: 64 }}>🎲 {T("seedShort")}</span>
        <input className="text-input" style={{ flex: 1 }} value={line.seed != null ? String(line.seed) : ""}
          placeholder={T("seedInherit")}
          onChange={(e) => onChange({ seed: e.target.value.trim() === "" ? null : parseInt(e.target.value, 10) })} />
        <button className="char-chip" onClick={onReroll}>🎲 {T("reroll")}</button>
      </div>
      <OutputCtrl label={"🏃 " + T("pace")} val={pace.toFixed(2) + "×"}>
        <Slider idx={sp.idx} value={pace} min={0.7} max={1.4} step={0.01} onChange={(v) => onChange({ pace: v })} />
      </OutputCtrl>
      <OutputCtrl label={"🎚️ " + T("strength")} val={cfg.toFixed(1)}>
        <Slider idx={sp.idx} value={cfg} min={1} max={10} step={0.5} onChange={(v) => onChange({ cfg: v })} />
      </OutputCtrl>
      <OutputCtrl label={"✨ " + T("quality")} val={String(steps)}>
        <Slider idx={sp.idx} value={steps} min={16} max={120} step={1} onChange={(v) => onChange({ steps: v })} />
      </OutputCtrl>
    </div>
  );
}

window.StudioScreen = StudioScreen;
