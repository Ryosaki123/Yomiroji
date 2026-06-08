/* CastScreen.jsx — assign a voice to each speaker, tune Irodori params, and
   manage the persistent voice library. Voices are created on the backend
   (design-by-prompt / upload reference / auto) and cloned for every line. */

const FACE_CHOICES = ["⚡️","🌙","🤓","🫧","🎩","🍯","🦊","🐙","🌵","🤖","🐝","🎙️","🦉","🍓","🐳","🌈"];
const SAMPLE_LINES = {
  en: ["Hey there, this is roughly what I sound like.", "Testing, testing — one, two, three.", "Ooh, I like the sound of that.", "Let me read this line back for you."],
  ja: ["どうも、これがだいたいの声の感じです。", "テスト、テスト、ワン・ツー・スリー。", "おお、いい感じですね。", "この行を読み上げてみますね。"],
};
function sampleLine(lang, i) {
  const set = SAMPLE_LINES[lang] || SAMPLE_LINES.ja;
  return set[(i || 0) % set.length];
}

function CastScreen({ speakers, setSpeakers, presets, setPresets, reloadVoices, onBack, onContinue, lines, sessionId }) {
  const T = window.tr;
  const [previewing, setPreviewing] = React.useState(null);
  const [saveFor, setSaveFor] = React.useState(null);
  const [faceOpen, setFaceOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(null);

  const update = (idx, patch) =>
    setSpeakers((prev) => prev.map((s) => (s.idx === idx ? { ...s, ...patch } : s)));

  const applyCharacter = (idx, c) =>
    update(idx, { characterId: c.id, voiceId: c.voiceId || c.id, face: c.face, model: c.model || "base",
      speed: c.speed, pitch: 0, cfg: c.cfg != null ? c.cfg : 5.0, steps: c.steps != null ? c.steps : 32,
      emotion: c.emotion || "neutral", lang: c.lang || "ja" });

  const deleteCharacter = (id) => {
    window.Api.deleteVoice(id).then(() => reloadVoices && reloadVoices()).catch(() => {});
    setSpeakers((prev) => prev.map((s) => (s.characterId === id ? { ...s, characterId: null } : s)));
  };

  const preview = (sp) => {
    if (!sp.voiceId) { window.__toast && window.__toast(T("assignVoiceFirst")); return; }
    const line = sampleLine(sp.lang, sp.idx);
    setPreviewing(sp.idx);
    window.VoiceSynth.play({
      voiceId: sp.voiceId, text: line, pace: sp.speed, cfg_scale_speaker: sp.cfg,
      num_steps: sp.steps, mood: sp.emotion, lang: sp.lang, sessionId,
      onEnd: () => setPreviewing((p) => (p === sp.idx ? null : p)),
    });
  };

  return (
    <div className="col">
      <div className="page-head">
        <div className="eyebrow">{T("s2eyebrow")}</div>
        <h1 className="title">{T("s2title")}</h1>
        <p className="subtitle">{T("s2subtitle")}</p>
      </div>

      <div className="cast-grid">
        {speakers.map((sp) => {
          const lc = lines.filter((l) => l.spk === sp.idx).length;
          const vl = window.voiceLangById(sp.lang);
          return (
            <div className="cast-card" key={sp.id} data-spk={sp.idx}>
              <div className="cast-head">
                <button className="avatar sz-lg" data-spk={sp.idx} onClick={() => setFaceOpen(faceOpen === sp.idx ? null : sp.idx)} title={T("changeFace")} style={{ cursor: "pointer", border: "none" }}>
                  <span className="emoji">{sp.face}</span>
                </button>
                <div className="who">
                  <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                    <span className="voice-from" data-spk={sp.idx} title={T("fromScriptTitle")}>
                      🏷 {sp.label || ("Speaker " + (sp.idx + 1))}
                    </span>
                    <span className="label" style={{ margin: 0 }}>{T("nLines", lc)}</span>
                  </div>
                  <input className="name-input" value={sp.name}
                    onChange={(e) => update(sp.idx, { name: e.target.value })} />
                  <div className="voice-assigned" data-spk={sp.idx}>
                    🎙 {T("voiceLabel")}：<b>{(presets.find((p) => p.id === sp.characterId) || {}).name || T("customMix")}</b>
                    <span style={{ opacity: .55 }}>·</span> {vl.flag} {vl.label}
                  </div>
                </div>
                <IconBtn idx={sp.idx} tinted ic={previewing === sp.idx ? <MiniWave idx={sp.idx} /> : "▶"}
                  title={T("previewVoice")} onClick={() => preview(sp)} />
              </div>

              {faceOpen === sp.idx && (
                <div className="emoji-grid" style={{ marginBottom: 16 }}>
                  {FACE_CHOICES.map((f) => (
                    <button key={f} className={"emoji-btn" + (sp.face === f ? " on" : "")} data-spk={sp.idx}
                      onClick={() => { update(sp.idx, { face: f }); setFaceOpen(null); }}>{f}</button>
                  ))}
                </div>
              )}

              {/* voice library chips */}
              <div className="char-strip">
                {presets.map((c) => (
                  <button key={c.id} className={"char-chip" + (sp.characterId === c.id ? " sel" : "")}
                    data-spk={sp.idx} onClick={() => applyCharacter(sp.idx, c)}>
                    <span className="mini" data-spk={sp.idx}>{c.face}</span>
                    {c.name}
                  </button>
                ))}
                <button className="char-chip" data-spk={sp.idx} onClick={() => setNewOpen(sp.idx)} title={T("newVoiceProfile")}>
                  <span className="mini" data-spk={sp.idx}>＋</span>
                  {T("newChip")}
                </button>
              </div>

              {/* language */}
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <div className="ctrl" style={{ flex: 1, marginTop: 8 }}>
                  <label className="field-label">{T("voiceLanguage")}</label>
                  <select className="select" data-spk={sp.idx} value={sp.lang}
                    onChange={(e) => update(sp.idx, { lang: e.target.value })}>
                    {window.VOICE_LANGS.map((l) => (
                      <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* pace -> duration_scale */}
              <div className="ctrl">
                <div className="ctrl-head">
                  <span className="ctrl-label">🏃 {T("pace")}</span>
                  <span className="ctrl-val">{(sp.speed || 1).toFixed(2)}×</span>
                </div>
                <Slider idx={sp.idx} value={sp.speed} min={0.7} max={1.4} step={0.01}
                  onChange={(v) => update(sp.idx, { speed: v, characterId: null })} />
              </div>

              {/* voice strength -> cfg_scale_speaker (Irodori has no pitch control) */}
              <div className="ctrl">
                <div className="ctrl-head">
                  <span className="ctrl-label">🎚️ {T("strength")}</span>
                  <span className="ctrl-val">{(sp.cfg != null ? sp.cfg : 5).toFixed(1)}</span>
                </div>
                <Slider idx={sp.idx} value={sp.cfg != null ? sp.cfg : 5} min={1} max={10} step={0.5}
                  onChange={(v) => update(sp.idx, { cfg: v, characterId: null })} />
              </div>

              {/* default mood (optional emoji appended to the line text) */}
              <div className="ctrl">
                <div className="ctrl-head">
                  <span className="ctrl-label">🎭 {T("defaultMood")}</span>
                </div>
                <div className="emoji-grid">
                  {window.EMOTIONS.map((e) => (
                    <button key={e.id} className={"emoji-btn" + (sp.emotion === e.id ? " on" : "")} data-spk={sp.idx}
                      title={window.emoLabel(e.id)} onClick={() => update(sp.idx, { emotion: e.id, characterId: null })}>
                      {e.em}
                    </button>
                  ))}
                  <button className={"emoji-btn" + (sp.emotion === "none" ? " on" : "")} data-spk={sp.idx}
                    title={T("emo_none")} onClick={() => update(sp.idx, { emotion: "none", characterId: null })}>🚫</button>
                </div>
              </div>

              <hr className="hr" />
              <div className="row between">
                <span className="model-tag">🧠 Irodori · {vl.flag}{vl.short}</span>
                <Btn kind="soft" size="sm" ic="＋" disabled={!sp.voiceId} onClick={() => setSaveFor(sp.idx)}>{T("saveAsCharacter")}</Btn>
              </div>
            </div>
          );
        })}
      </div>

      {/* library bank */}
      <div className="card pad" style={{ marginTop: "var(--gap)" }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <div className="side-label">{T("characterLibrary")}</div>
            <p className="muted" style={{ fontSize: 13.5, margin: "4px 0 0" }}>{T("librarySubtitle")}</p>
          </div>
          <Btn kind="soft" size="sm" ic="＋" onClick={() => setNewOpen("lib")}>{T("newVoice")}</Btn>
        </div>
        <div className="preset-bank">
          {presets.map((c) => {
            const cl = window.voiceLangById(c.lang);
            return (
              <div className="preset-card" key={c.id} data-spk={0}>
                <button className="preset-del" title={T("deleteVoice")} onClick={() => deleteCharacter(c.id)}>✕</button>
                <div className="avatar sz-md" data-spk={c.builtin ? 2 : 3}><span className="emoji">{c.face}</span></div>
                <div className="meta">
                  <div className="nm">{c.name} <span style={{ fontSize: 12, opacity: .7 }}>{cl.flag}</span></div>
                  <div className="ds">{c.desc}</div>
                </div>
              </div>
            );
          })}
          <button className="new-voice-card" onClick={() => setNewOpen("lib")}>
            <span className="plus">＋</span>
            {T("newVoiceProfile")}
          </button>
        </div>
      </div>

      <div className="row between" style={{ marginTop: 26 }}>
        <Btn kind="ghost" ic="←" onClick={onBack}>{T("backToScript")}</Btn>
        <Btn kind="primary" size="lg" ic="→" onClick={onContinue}>{T("openStudio")}</Btn>
      </div>

      {saveFor !== null && (
        <SaveCharacterModal speaker={speakers[saveFor]}
          onClose={() => setSaveFor(null)}
          onSave={(name, desc) => {
            const sp = speakers[saveFor];
            window.Api.saveVoice({
              fromVoiceId: sp.voiceId, name, desc, face: sp.face, lang: sp.lang,
              source: "clone", pace: sp.speed, cfg_scale_speaker: sp.cfg, num_steps: sp.steps,
            }).then((r) => {
              reloadVoices && reloadVoices();
              if (r.voice) update(saveFor, { characterId: r.voice.id, voiceId: r.voice.id });
            }).catch((e) => window.__toast && window.__toast(String(e.message || e)));
            setSaveFor(null);
          }} />
      )}

      {newOpen !== null && (
        <NewVoiceModal sessionId={sessionId}
          onClose={() => setNewOpen(null)}
          onCreated={(voice) => {
            reloadVoices && reloadVoices();
            if (typeof newOpen === "number" && voice) applyCharacter(newOpen, window.voiceToCharacter(voice));
            setNewOpen(null);
          }} />
      )}
    </div>
  );
}

function SaveCharacterModal({ speaker, onClose, onSave }) {
  const T = window.tr;
  const [name, setName] = React.useState(speaker.name);
  const [desc, setDesc] = React.useState("");
  const moodLabel = window.emoLabel(speaker.emotion);
  const vl = window.voiceLangById(speaker.lang);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ gap: 14, marginBottom: 18 }}>
          <div className="avatar sz-lg" data-spk={3}><span className="emoji">{speaker.face}</span></div>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: 22 }}>{T("saveCharTitle")}</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
              {vl.flag}{vl.short} · {moodLabel} · {(speaker.speed || 1).toFixed(2)}× · {T("strength")} {(speaker.cfg || 5).toFixed(1)}
            </p>
          </div>
        </div>
        <label className="field-label">{T("voiceName")}</label>
        <input className="text-input" value={name} autoFocus
          onChange={(e) => setName(e.target.value)} placeholder={T("namePh")} />
        <label className="field-label" style={{ marginTop: 14 }}>{T("description")}</label>
        <input className="text-input" value={desc}
          onChange={(e) => setDesc(e.target.value)} placeholder={T("descPh")} />
        <div className="row between" style={{ marginTop: 22 }}>
          <Btn kind="ghost" onClick={onClose}>{T("cancel")}</Btn>
          <Btn kind="primary" ic="✓" disabled={!name.trim()}
            onClick={() => onSave(name.trim(), desc.trim() || T("customMix"))}>{T("saveCharacter")}</Btn>
        </div>
      </div>
    </div>
  );
}

// Create a brand-new voice on the backend: design-by-prompt / upload / auto.
function NewVoiceModal({ onClose, onCreated, sessionId }) {
  const T = window.tr;
  const [method, setMethod] = React.useState("design"); // design | upload | auto
  const [name, setName] = React.useState("New voice");
  const [desc, setDesc] = React.useState("");
  const [face, setFace] = React.useState("🎙️");
  const [lang, setLang] = React.useState("ja");
  const [caption, setCaption] = React.useState("");
  const [seed, setSeed] = React.useState("");
  const [uploadName, setUploadName] = React.useState("");
  const [uploadB64, setUploadB64] = React.useState(null);
  const [preview, setPreview] = React.useState(null); // { previewId, wavUrl }
  const [busy, setBusy] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const fileRef = React.useRef(null);

  const onFile = async (file) => {
    if (!file) return;
    setUploadName(file.name);
    setUploadB64(await window.Api.fileToBase64(file));
    setPreview(null);
  };

  // regen=true -> reroll a fresh random seed (a different voice each time)
  const doPreview = async (regen) => {
    setBusy(true); setPreview(null);
    try {
      const useSeed = regen ? null : (seed.trim() === "" ? null : parseInt(seed, 10));
      const body = {
        source: method, lang, seed: useSeed,
        caption: method === "design" ? caption : null,
        audio_b64: method === "upload" ? uploadB64 : null,
        filename: method === "upload" ? uploadName : null,
      };
      const r = await window.Api.previewVoice(body);
      setPreview(r);
      if (r.seed != null) setSeed(String(r.seed)); // reflect the seed actually used
      setPlaying(true);
      window.VoiceSynth.playUrl(r.wavUrl, () => setPlaying(false));
    } catch (e) {
      window.__toast && window.__toast(String(e.message || e));
    }
    setBusy(false);
  };

  const playPreview = () => {
    if (!preview) return;
    setPlaying(true);
    window.VoiceSynth.playUrl(preview.wavUrl, () => setPlaying(false));
  };

  const create = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await window.Api.saveVoice({
        previewId: preview.previewId, name: name.trim(), desc: desc.trim() || T("customMix"),
        face, lang, source: method, caption: method === "design" ? caption : null,
        seed: seed.trim() === "" ? null : parseInt(seed, 10),
      });
      onCreated(r.voice);
    } catch (e) {
      window.__toast && window.__toast(String(e.message || e));
    }
    setBusy(false);
  };

  const canPreview = method === "design" ? caption.trim().length > 0
    : method === "upload" ? !!uploadB64 : true;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide" data-spk={3} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ gap: 14, marginBottom: 16 }}>
          <div className="avatar sz-lg" data-spk={3}><span className="emoji">{face}</span></div>
          <div className="grow">
            <h2 style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: 22 }}>{T("newVoiceProfile")}</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{T("newVoiceProfileSub")}</p>
          </div>
          <IconBtn idx={3} tinted ic={playing ? <MiniWave idx={3} /> : "▶"} title={T("preview")}
            onClick={playPreview} />
        </div>

        {/* method tabs */}
        <div className="char-strip" style={{ marginBottom: 14 }}>
          {[["design", T("methodDesign")], ["upload", T("methodUpload")], ["auto", T("methodAuto")]].map(([m, lbl]) => (
            <button key={m} className={"char-chip" + (method === m ? " sel" : "")} data-spk={3}
              onClick={() => { setMethod(m); setPreview(null); }}>{lbl}</button>
          ))}
        </div>

        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">{T("voiceName")}</label>
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={T("namePh2")} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">{T("description")}</label>
            <input className="text-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={T("descPh2")} />
          </div>
        </div>

        <div className="row" style={{ gap: 12, alignItems: "flex-start", marginTop: 12 }}>
          <div className="ctrl" style={{ flex: 1 }}>
            <label className="field-label">{T("voiceLanguage")}</label>
            <select className="select" data-spk={3} value={lang} onChange={(e) => setLang(e.target.value)}>
              {window.VOICE_LANGS.map((l) => (<option key={l.id} value={l.id}>{l.flag} {l.label}</option>))}
            </select>
          </div>
          <div className="ctrl" style={{ flex: 1 }}>
            <label className="field-label">{T("seedLabel")}</label>
            <input className="text-input" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder={T("seedPh")} />
          </div>
        </div>

        {method === "design" && (
          <>
            <label className="field-label" style={{ marginTop: 14 }}>{T("promptLabel")}</label>
            <textarea className="text-input" value={caption} rows={2} style={{ resize: "vertical" }}
              onChange={(e) => setCaption(e.target.value)} placeholder={T("promptPh")} />
          </>
        )}
        {method === "upload" && (
          <>
            <label className="field-label" style={{ marginTop: 14 }}>{T("uploadLabel")}</label>
            <div className="drop-hint" role="button" onClick={() => fileRef.current && fileRef.current.click()}>
              <span style={{ fontSize: 18 }}>🎧</span>
              <span>{uploadName || T("uploadHint")}</span>
              <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg" hidden
                onChange={(e) => onFile(e.target.files[0])} />
            </div>
          </>
        )}
        {method === "auto" && (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>{T("autoHint")}</p>
        )}

        <label className="field-label" style={{ marginTop: 16 }}>{T("face")}</label>
        <div className="emoji-grid">
          {FACE_CHOICES.map((f) => (
            <button key={f} className={"emoji-btn" + (face === f ? " on" : "")} data-spk={3}
              onClick={() => setFace(f)}>{f}</button>
          ))}
        </div>

        <div className="row between" style={{ marginTop: 22 }}>
          <Btn kind="ghost" onClick={onClose}>{T("cancel")}</Btn>
          <div className="row" style={{ gap: 10 }}>
            <Btn kind="soft" ic={busy ? "⏳" : "✨"} disabled={busy || !canPreview} onClick={() => doPreview(!!preview)}>
              {preview ? T("regenerate") : T("preview")}
            </Btn>
            <Btn kind="primary" ic="✓" disabled={busy || !preview || !name.trim()} onClick={create}>
              {T("createVoice")}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CastScreen = CastScreen;

// ---- Character Manager: session-independent library (create / edit / delete / preview) ----
function CharacterRow({ c, sessionId, onSaved, onDelete }) {
  const T = window.tr;
  const [editing, setEditing] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [d, setD] = React.useState(c);
  React.useEffect(() => { setD(c); }, [c.id, c.name, c.desc, c.face, c.lang, c.speed, c.cfg, c.steps, c.emotion]);
  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  const vl = window.voiceLangById(d.lang);

  const preview = () => {
    setPreviewing(true);
    window.VoiceSynth.play({
      voiceId: c.id, text: sampleLine(d.lang, 0), pace: d.speed, cfg_scale_speaker: d.cfg,
      num_steps: d.steps, mood: d.emotion, lang: d.lang, sessionId,
      onEnd: () => setPreviewing(false),
    });
  };
  const save = () => {
    window.Api.updateVoice(c.id, {
      name: d.name, desc: d.desc, face: d.face, language: d.lang,
      pace: d.speed, cfg_scale_speaker: d.cfg, num_steps: d.steps, emotion: d.emotion,
    }).then(() => { setEditing(false); onSaved && onSaved(); })
      .catch((e) => window.__toast && window.__toast(String(e.message || e)));
  };

  return (
    <div className="card pad" data-spk={c.builtin ? 2 : 3} style={{ marginBottom: 10 }}>
      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        <div className="avatar sz-md" data-spk={c.builtin ? 2 : 3}><span className="emoji">{d.face}</span></div>
        <div className="grow">
          <div className="nm" style={{ fontWeight: 800 }}>{d.name} <span style={{ fontSize: 12, opacity: .7 }}>{vl.flag}</span></div>
          <div className="ds muted" style={{ fontSize: 12.5 }}>{d.desc}</div>
        </div>
        <IconBtn idx={3} tinted ic={previewing ? <MiniWave idx={3} /> : "▶"} title={T("previewVoice")} onClick={preview} />
        <button className={"char-chip" + (editing ? " sel" : "")} data-spk={3} onClick={() => setEditing((e) => !e)}>✎ {T("edit")}</button>
        <button className="char-chip" onClick={onDelete} title={T("deleteVoice")}>✕</button>
      </div>

      {editing && (
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">{T("voiceName")}</label>
              <input className="text-input" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">{T("description")}</label>
              <input className="text-input" value={d.desc} onChange={(e) => set({ desc: e.target.value })} />
            </div>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>{T("voiceLanguage")}</label>
          <select className="select" data-spk={3} value={d.lang} onChange={(e) => set({ lang: e.target.value })}>
            {window.VOICE_LANGS.map((l) => (<option key={l.id} value={l.id}>{l.flag} {l.label}</option>))}
          </select>
          <label className="field-label" style={{ marginTop: 12 }}>{T("face")}</label>
          <div className="emoji-grid">
            {FACE_CHOICES.map((f) => (
              <button key={f} className={"emoji-btn" + (d.face === f ? " on" : "")} data-spk={3} onClick={() => set({ face: f })}>{f}</button>
            ))}
          </div>
          <div className="ctrl"><div className="ctrl-head"><span className="ctrl-label">🏃 {T("pace")}</span><span className="ctrl-val">{(d.speed || 1).toFixed(2)}×</span></div>
            <Slider idx={3} value={d.speed} min={0.7} max={1.4} step={0.01} onChange={(v) => set({ speed: v })} /></div>
          <div className="ctrl"><div className="ctrl-head"><span className="ctrl-label">🎚️ {T("strength")}</span><span className="ctrl-val">{(d.cfg != null ? d.cfg : 5).toFixed(1)}</span></div>
            <Slider idx={3} value={d.cfg != null ? d.cfg : 5} min={1} max={10} step={0.5} onChange={(v) => set({ cfg: v })} /></div>
          <div className="ctrl"><div className="ctrl-head"><span className="ctrl-label">✨ {T("quality")}</span><span className="ctrl-val">{d.steps}</span></div>
            <Slider idx={3} value={d.steps != null ? d.steps : 45} min={16} max={120} step={1} onChange={(v) => set({ steps: v })} /></div>
          <div className="ctrl-head"><span className="ctrl-label">🎭 {T("defaultMood")}</span></div>
          <div className="emoji-grid">
            {window.EMOTIONS.map((e) => (
              <button key={e.id} className={"emoji-btn" + (d.emotion === e.id ? " on" : "")} data-spk={3}
                title={window.emoLabel(e.id)} onClick={() => set({ emotion: e.id })}>{e.em}</button>
            ))}
            <button className={"emoji-btn" + (d.emotion === "none" ? " on" : "")} data-spk={3}
              title={T("emo_none")} onClick={() => set({ emotion: "none" })}>🚫</button>
          </div>
          <div className="row between" style={{ marginTop: 14 }}>
            <Btn kind="ghost" onClick={() => { setD(c); setEditing(false); }}>{T("cancel")}</Btn>
            <Btn kind="primary" ic="✓" onClick={save}>{T("saveChanges")}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterManager({ onClose, voices, reloadVoices, sessionId }) {
  const T = window.tr;
  const [newOpen, setNewOpen] = React.useState(false);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: 22 }}>🎭 {T("charactersTitle")}</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{T("charactersSub")}</p>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Btn kind="soft" ic="＋" onClick={() => setNewOpen(true)}>{T("newVoice")}</Btn>
            <Btn kind="ghost" onClick={onClose}>{T("close")}</Btn>
          </div>
        </div>
        {(!voices || !voices.length) && <p className="muted" style={{ fontSize: 14 }}>{T("noVoicesYet")}</p>}
        {(voices || []).map((c) => (
          <CharacterRow key={c.id} c={c} sessionId={sessionId} onSaved={reloadVoices}
            onDelete={() => { window.Api.deleteVoice(c.id).then(() => reloadVoices && reloadVoices()).catch(() => {}); }} />
        ))}
        {newOpen && (
          <NewVoiceModal sessionId={sessionId} onClose={() => setNewOpen(false)}
            onCreated={() => { reloadVoices && reloadVoices(); setNewOpen(false); }} />
        )}
      </div>
    </div>
  );
}

window.CharacterManager = CharacterManager;
