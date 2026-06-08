/* app.jsx — shell: sessions, sidebar, stepper, routing, tweaks, persistence */

const { useState, useEffect, useMemo, useRef } = React;

const DEFAULT_CAST = ["host-spark", "guest-doc", "narr-sage", "side-bub"]; // by speaker idx

const ACCENTS = {
  coral:  { brand: "0.68 0.165 33",  soft: "0.93 0.05 40",  press: "0.62 0.17 33",  ink: "0.40 0.13 33" },
  grape:  { brand: "0.62 0.15 300",  soft: "0.93 0.05 300", press: "0.56 0.155 300", ink: "0.40 0.12 300" },
  ocean:  { brand: "0.60 0.13 245",  soft: "0.93 0.05 250", press: "0.54 0.14 245",  ink: "0.40 0.11 245" },
  forest: { brand: "0.60 0.12 155",  soft: "0.93 0.045 155", press: "0.54 0.13 155", ink: "0.40 0.10 155" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "coral",
  "displayFont": "Bricolage Grotesque",
  "density": "regular",
  "showModel": true,
  "uiLang": "日本語"
}/*EDITMODE-END*/;

function Stepper({ step, go, canCast, canStudio }) {
  const T = window.tr;
  const steps = [
    { id: "script", n: 1, label: T("stepScript"), ok: true },
    { id: "cast", n: 2, label: T("stepCast"), ok: canCast },
    { id: "studio", n: 3, label: T("stepStudio"), ok: canStudio },
  ];
  const order = ["script", "cast", "studio"];
  const cur = order.indexOf(step);
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.id);
        const cls = step === s.id ? "active" : idx < cur ? "done" : (s.ok ? "" : "todo");
        return (
          <React.Fragment key={s.id}>
            {i > 0 && <span className="step-arrow">›</span>}
            <button className={"step " + cls} disabled={!s.ok}
              onClick={() => s.ok && go(s.id)}>
              <span className="num">{idx < cur ? "✓" : s.n}</span>
              {s.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function initialState() {
  const saved = window.loadState();
  if (saved && saved.sessions && saved.sessions.length) {
    return {
      sessions: saved.sessions,
      activeId: saved.activeId && saved.sessions.some((s) => s.id === saved.activeId) ? saved.activeId : saved.sessions[0].id,
      library: saved.library && saved.library.length ? saved.library : window.PRESET_CHARACTERS,
    };
  }
  const demo = window.makeSession({ title: "グルメ討論", raw: window.SAMPLE_JA });
  return { sessions: [demo], activeId: demo.id, library: window.PRESET_CHARACTERS };
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // set UI language synchronously before children render
  window.setUILang(t.uiLang === "English" ? "en" : "ja");
  const T = window.tr;
  const boot = useRef(initialState());
  const [sessions, setSessions] = useState(boot.current.sessions);
  const [activeId, setActiveId] = useState(boot.current.activeId);
  const [library, setLibrary] = useState(boot.current.library);
  const [toast, setToast] = useState(null);

  const active = sessions.find((s) => s.id === activeId) || sessions[0];

  // ---- persistence ----
  useEffect(() => { window.saveState({ sessions, activeId, library }); }, [sessions, activeId, library]);

  // ---- tweaks → CSS ----
  useEffect(() => {
    const root = document.documentElement;
    const a = ACCENTS[t.accent] || ACCENTS.coral;
    root.style.setProperty("--brand", `oklch(${a.brand})`);
    root.style.setProperty("--brand-soft", `oklch(${a.soft})`);
    root.style.setProperty("--brand-press", `oklch(${a.press})`);
    root.style.setProperty("--brand-ink", `oklch(${a.ink})`);
    root.style.setProperty("--font-display", `"${t.displayFont}", system-ui, sans-serif`);
    root.setAttribute("data-density", t.density);
  }, [t.accent, t.displayFont, t.density]);

  const showToast = (msg) => { setToast(msg); clearTimeout(window.__tT); window.__tT = setTimeout(() => setToast(null), 2600); };

  // ---- active-session setters ----
  const patch = (p) => setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, ...p, updatedAt: Date.now() } : s)));
  const resolve = (key, updater, prevVal) => (typeof updater === "function" ? updater(prevVal) : updater);
  const setRaw = (v) => patch({ raw: v });
  const setStep = (v) => patch({ step: v });
  const setSpeakers = (u) => setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, speakers: resolve("speakers", u, s.speakers), updatedAt: Date.now() } : s)));
  const setLines = (u) => setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, lines: resolve("lines", u, s.lines), updatedAt: Date.now() } : s)));
  const setPresets = (u) => setLibrary((prev) => resolve("lib", u, prev));

  const globalModel = active.speakers[0] ? active.speakers[0].model : "echo2";

  const buildCast = (parsed) => {
    const sps = parsed.speakers.map((sp) => {
      const c = library.find((p) => p.id === DEFAULT_CAST[sp.idx]) || library[sp.idx % library.length];
      return { id: sp.id, idx: sp.idx, name: sp.name, label: sp.label, characterId: c.id, face: c.face, model: c.model, speed: c.speed, pitch: c.pitch, emotion: c.emotion, lang: c.lang || "ja" };
    });
    patch({ speakers: sps, lines: parsed.lines, step: "cast", title: active.title && active.title !== "Untitled podcast" && active.title !== "無題のポッドキャスト" ? active.title : window.titleFromSpeakers(sps) });
  };

  // ---- session ops ----
  const newSession = () => {
    const s = window.makeSession({ title: window.tr("untitled") });
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
  };
  const selectSession = (id) => { window.VoiceSynth.stop(); setActiveId(id); };
  const renameSession = (id, title) => setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  const deleteSession = (id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (!next.length) { const blank = window.makeSession(); setActiveId(blank.id); return [blank]; }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  return (
    <div className="app-shell">
      <SessionSidebar
        sessions={sessions} activeId={activeId}
        onSelect={selectSession} onNew={newSession}
        onRename={renameSession} onDelete={deleteSession} />

      <div className="app-main">
        <header className="topbar">
          <div className="sess-title-top" title={active.title}>{active.title}</div>
          <span className="spacer" />
          <Stepper step={active.step} go={setStep} canCast={active.speakers.length > 0} canStudio={active.lines.length > 0} />
          <span className="spacer" />
          {t.showModel && (
            <div className="model-chip">
              <span className="dot" />
              <b>{(window.MODELS.find((m) => m.id === globalModel) || window.MODELS[0]).name}</b>
              <span className="sep">·</span>
              <span>{T("localPrivate")}</span>
            </div>
          )}
        </header>

        <main className="main">
          {active.step === "script" && (
            <ScriptScreen key={active.id + ":script"} raw={active.raw} setRaw={setRaw} model={globalModel} onContinue={buildCast} />
          )}
          {active.step === "cast" && (
            <CastScreen key={active.id + ":cast"}
              speakers={active.speakers} setSpeakers={setSpeakers}
              presets={library} setPresets={setPresets}
              lines={active.lines}
              onBack={() => setStep("script")} onContinue={() => setStep("studio")} />
          )}
          {active.step === "studio" && (
            <StudioScreen key={active.id + ":studio"} lines={active.lines} setLines={setLines} speakers={active.speakers}
              onBack={() => setStep("cast")} onToast={showToast} />
          )}
        </main>
      </div>

      {toast && <Toast>{toast}</Toast>}

      <TweaksPanel>
        <TweakSection label={T("twLook")} />
        <TweakColor label={T("twAccent")} value={t.accent === "coral" ? "#e0744f" : t.accent === "grape" ? "#9a5cc8" : t.accent === "ocean" ? "#4f7fd0" : "#4fa377"}
          options={["#e0744f", "#9a5cc8", "#4f7fd0", "#4fa377"]}
          onChange={(hex) => setTweak("accent", { "#e0744f": "coral", "#9a5cc8": "grape", "#4f7fd0": "ocean", "#4fa377": "forest" }[hex] || "coral")} />
        <TweakRadio label={T("twFont")} value={t.displayFont}
          options={["Bricolage Grotesque", "Space Grotesk"]}
          onChange={(v) => setTweak("displayFont", v)} />
        <TweakRadio label={T("twDensity")} value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label={T("twStudio")} />
        <TweakRadio label={T("twLang")} value={t.uiLang}
          options={["日本語", "English"]}
          onChange={(v) => setTweak("uiLang", v)} />
        <TweakToggle label={T("twShowModel")} value={t.showModel}
          onChange={(v) => setTweak("showModel", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
