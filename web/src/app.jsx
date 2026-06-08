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
  "uiLang": "日本語",
  "dark": false
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
  // Sessions persist locally; the voice library is the backend's source of truth
  // (hydrated by an effect), so we start it empty here.
  const saved = window.loadState();
  if (saved && saved.sessions && saved.sessions.length) {
    return {
      sessions: saved.sessions,
      activeId: saved.activeId && saved.sessions.some((s) => s.id === saved.activeId) ? saved.activeId : saved.sessions[0].id,
      library: [],
    };
  }
  const demo = window.makeSession({ title: "グルメ討論", raw: window.SAMPLE_JA });
  return { sessions: [demo], activeId: demo.id, library: [] };
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
  const [charMgrOpen, setCharMgrOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(null); // null = not editing the top-bar title

  const active = sessions.find((s) => s.id === activeId) || sessions[0];
  useEffect(() => { document.title = window.APP_NAME; }, []);

  // ---- persistence (sessions only; library lives on the backend) ----
  useEffect(() => { window.saveState({ sessions, activeId }); }, [sessions, activeId]);

  // ---- hydrate models + voice library from the local backend ----
  const reloadVoices = React.useCallback(() => {
    window.Api.getVoices()
      .then((d) => setLibrary((d.voices || []).map(window.voiceToCharacter)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    window.Api.getModels().then((d) => { if (d.models && d.models.length) window.MODELS = d.models; }).catch(() => {});
    reloadVoices();
  }, [reloadVoices]);
  // expose for screens (toast + voice-library refresh after create/delete)
  window.__reloadVoices = reloadVoices;

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
    root.setAttribute("data-theme", t.dark ? "dark" : "light");
  }, [t.accent, t.displayFont, t.density, t.dark]);

  const showToast = (msg) => { setToast(msg); clearTimeout(window.__tT); window.__tT = setTimeout(() => setToast(null), 2600); };
  window.__toast = showToast;

  // ---- active-session setters ----
  const patch = (p) => setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, ...p, updatedAt: Date.now() } : s)));
  const resolve = (key, updater, prevVal) => (typeof updater === "function" ? updater(prevVal) : updater);
  const setRaw = (v) => patch({ raw: v });
  const setStep = (v) => patch({ step: v });
  const setSpeakers = (u) => setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, speakers: resolve("speakers", u, s.speakers), updatedAt: Date.now() } : s)));
  const setLines = (u) => setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, lines: resolve("lines", u, s.lines), updatedAt: Date.now() } : s)));
  const setPresets = (u) => setLibrary((prev) => resolve("lib", u, prev));

  const globalModel = active.speakers[0] ? active.speakers[0].model : "base";

  const buildCast = (parsed) => {
    const sps = parsed.speakers.map((sp) => {
      const c = library.length ? library[sp.idx % library.length] : null;
      return {
        id: sp.id, idx: sp.idx, name: sp.name, label: sp.label,
        characterId: c ? c.id : null, voiceId: c ? c.voiceId : null,
        face: c ? c.face : "🎙️", model: c ? c.model : "base",
        speed: c ? c.speed : 1.0, pitch: 0,
        cfg: c ? c.cfg : 5.0, steps: c ? c.steps : 32,
        emotion: c ? c.emotion : "neutral", lang: c ? c.lang : "ja",
      };
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
        onRename={renameSession} onDelete={deleteSession}
        onOpenCharacters={() => setCharMgrOpen(true)} />

      <div className="app-main">
        <header className="topbar">
          {titleDraft === null ? (
            <div className="sess-title-top" title={T("renameSession")} style={{ cursor: "text" }}
              onClick={() => setTitleDraft(active.title)}>
              {active.title} <span style={{ opacity: .4, fontSize: 13 }}>✎</span>
            </div>
          ) : (
            <input className="sess-rename" autoFocus value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => { renameSession(activeId, titleDraft.trim() || T("untitled")); setTitleDraft(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { renameSession(activeId, titleDraft.trim() || T("untitled")); setTitleDraft(null); }
                if (e.key === "Escape") setTitleDraft(null);
              }} />
          )}
          <span className="spacer" />
          <Stepper step={active.step} go={setStep} canCast={active.speakers.length > 0} canStudio={active.lines.length > 0} />
          <span className="spacer" />
          <Btn kind="soft" size="sm" onClick={() => setTweak("dark", !t.dark)}
            title={T("twDark")}>{t.dark ? "☀️" : "🌙"}</Btn>
          <Btn kind="soft" size="sm" onClick={() => window.postMessage({ type: "__activate_edit_mode" }, "*")}
            title={T("settingsTitle")}>⚙</Btn>
          <Btn kind="soft" size="sm" ic="🎭" onClick={() => setCharMgrOpen(true)}>{T("charactersTitle")}</Btn>
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
              presets={library} setPresets={setPresets} reloadVoices={reloadVoices}
              lines={active.lines} sessionId={active.id}
              onBack={() => setStep("script")} onContinue={() => setStep("studio")} />
          )}
          {active.step === "studio" && (
            <StudioScreen key={active.id + ":studio"} lines={active.lines} setLines={setLines} speakers={active.speakers}
              sessionId={active.id} title={active.title}
              onBack={() => setStep("cast")} onToast={showToast} />
          )}
        </main>
      </div>

      {toast && <Toast>{toast}</Toast>}

      {charMgrOpen && (
        <CharacterManager onClose={() => setCharMgrOpen(false)}
          voices={library} reloadVoices={reloadVoices} sessionId={active.id} />
      )}

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
        <TweakToggle label={T("twDark")} value={!!t.dark}
          onChange={(v) => setTweak("dark", v)} />
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
