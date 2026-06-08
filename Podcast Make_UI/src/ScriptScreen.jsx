/* ScriptScreen.jsx — paste / upload script, live speaker auto-detect */

function ScriptScreen({ raw, setRaw, onContinue, model }) {
  const [drag, setDrag] = React.useState(false);
  const fileRef = React.useRef(null);
  const T = window.tr;

  const parsed = React.useMemo(() => window.parseScript(raw || ""), [raw]);
  const hasContent = (raw || "").trim().length > 0;
  const lineCount = parsed.lines.length;
  const totalDur = parsed.lines.reduce((s, l) => s + l.dur + l.pauseAfter, 0);

  const onFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result || ""));
    reader.readAsText(file);
  };

  return (
    <div className="col col-narrow">
      <div className="page-head">
        <div className="eyebrow">{T("s1eyebrow")}</div>
        <h1 className="title">{T("s1title")}</h1>
        <p className="subtitle">{T("s1subtitle")}</p>
      </div>

      <div className="script-grid">
        <div className="editor-wrap">
          <div
            className={"drop-hint" + (drag ? " drag" : "")}
            style={{ marginBottom: 14 }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current && fileRef.current.click()}
            role="button"
          >
            <span style={{ fontSize: 18 }}>📄</span>
            <span>{T("dropHint")}</span>
            <input ref={fileRef} type="file" accept=".txt,.md,text/plain" hidden
              onChange={(e) => onFile(e.target.files[0])} />
          </div>

          <textarea
            className="script-area"
            placeholder={T("placeholder")}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
          />

          <div className="row wrap" style={{ marginTop: 14, gap: 9 }}>
            <span className="muted" style={{ fontSize: 13, marginRight: 4 }}>{T("trySample")}</span>
            <button className="sample-pill" onClick={() => setRaw(window.SAMPLE_JA)}>{T("sampleJa")}</button>
            <button className="sample-pill" onClick={() => setRaw(window.SAMPLE_SCRIPT)}>{T("sampleEn")}</button>
            <button className="sample-pill" onClick={() => setRaw(window.SAMPLE_JA.split("\n").slice(0, 6).join("\n"))}>{T("sampleSnippet")}</button>
            {hasContent && (
              <button className="sample-pill" onClick={() => setRaw("")}>{T("clear")}</button>
            )}
          </div>
        </div>

        {/* live detection panel */}
        <aside className="card pad side-card">
          <div className="side-label">{T("detectedSpeakers")}</div>

          {!hasContent && (
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>{T("detectEmpty")}</p>
          )}

          {hasContent && parsed.speakers.map((sp) => {
            const count = parsed.lines.filter((l) => l.spk === sp.idx).length;
            return (
              <div className="detect-row" key={sp.id} data-spk={sp.idx}>
                <Avatar idx={sp.idx} face={sp.name.slice(0, 1).toUpperCase()} size="sm" />
                <div className="grow">
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{sp.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{T("nLines", count)}</div>
                </div>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: "var(--spk)" }} data-spk={sp.idx} />
              </div>
            );
          })}

          {hasContent && (
            <>
              <hr className="hr" />
              <div className="row between" style={{ fontSize: 13 }}>
                <span className="muted">{T("lines")}</span><b>{lineCount}</b>
              </div>
              <div className="row between" style={{ fontSize: 13 }}>
                <span className="muted">{T("estLength")}</span><b>{window.fmtTime(totalDur)}</b>
              </div>
              <div className="row between" style={{ fontSize: 13 }}>
                <span className="muted">{T("speakers")}</span><b>{parsed.speakers.length} / 4</b>
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="row between" style={{ marginTop: 26 }}>
        <div className="model-chip">
          <span className="dot" />
          <span>{T("runningLocally")}</span><span className="sep">·</span>
          <b>{(window.MODELS.find((m) => m.id === model) || window.MODELS[0]).name}</b>
        </div>
        <Btn kind="primary" size="lg" ic="→" disabled={!hasContent}
          onClick={() => onContinue(parsed)}>
          {T("castTheVoices")}
        </Btn>
      </div>
    </div>
  );
}

window.ScriptScreen = ScriptScreen;
