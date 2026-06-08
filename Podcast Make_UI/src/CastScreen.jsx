/* CastScreen.jsx — assign a voice "character" to each speaker, tune it, save presets */

const FACE_CHOICES = ["⚡️","🌙","🤓","🫧","🎩","🍯","🦊","🐙","🌵","🤖","🐝","🎙️","🦉","🍓","🐳","🌈"];
const SAMPLE_LINES = {
  en: ["Hey there, this is roughly what I sound like.", "Testing, testing — one, two, three.", "Ooh, I like the sound of that.", "Let me read this line back for you."],
  ja: ["どうも、これがだいたいの声の感じです。", "テスト、テスト、ワン・ツー・スリー。", "おお、いい感じですね。", "この行を読み上げてみますね。"],
};
function sampleLine(lang, i) {
  const set = SAMPLE_LINES[lang] || SAMPLE_LINES.ja;
  return set[i % set.length];
}

function CastScreen({ speakers, setSpeakers, presets, setPresets, onBack, onContinue, lines }) {
  const T = window.tr;
  const [previewing, setPreviewing] = React.useState(null);
  const [saveFor, setSaveFor] = React.useState(null);
  const [faceOpen, setFaceOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(null);

  const update = (idx, patch) =>
    setSpeakers((prev) => prev.map((s) => (s.idx === idx ? { ...s, ...patch } : s)));

  const applyCharacter = (idx, c) =>
    update(idx, { characterId: c.id, face: c.face, model: c.model, speed: c.speed, pitch: c.pitch, emotion: c.emotion, lang: c.lang || "ja" });

  const deleteCharacter = (id) => {
    setPresets((prev) => prev.filter((c) => c.id !== id));
    setSpeakers((prev) => prev.map((s) => (s.characterId === id ? { ...s, characterId: null } : s)));
  };

  const preview = (sp) => {
    const line = sampleLine(sp.lang, sp.idx);
    setPreviewing(sp.idx);
    window.VoiceSynth.play({
      pitch: sp.pitch, speed: sp.speed, emotion: sp.emotion, seed: sp.idx,
      dur: window.estimateDur(line),
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

              {/* character presets */}
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

              {/* model + language */}
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <div className="ctrl" style={{ flex: 1, marginTop: 8 }}>
                  <label className="field-label">{T("localModel")}</label>
                  <select className="select" data-spk={sp.idx} value={sp.model}
                    onChange={(e) => update(sp.idx, { model: e.target.value, characterId: null })}>
                    {window.MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} — {window.modelNote(m.id)} ({m.size})</option>
                    ))}
                  </select>
                </div>
                <div className="ctrl" style={{ flex: 1, marginTop: 8 }}>
                  <label className="field-label">{T("voiceLanguage")}</label>
                  <select className="select" data-spk={sp.idx} value={sp.lang}
                    onChange={(e) => update(sp.idx, { lang: e.target.value, characterId: null })}>
                    {window.VOICE_LANGS.map((l) => (
                      <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* speed */}
              <div className="ctrl">
                <div className="ctrl-head">
                  <span className="ctrl-label">🏃 {T("pace")}</span>
                  <span className="ctrl-val">{sp.speed.toFixed(2)}×</span>
                </div>
                <Slider idx={sp.idx} value={sp.speed} min={0.7} max={1.4} step={0.01}
                  onChange={(v) => update(sp.idx, { speed: v, characterId: null })} />
              </div>

              {/* pitch */}
              <div className="ctrl">
                <div className="ctrl-head">
                  <span className="ctrl-label">🎚️ {T("pitch")}</span>
                  <span className="ctrl-val">{sp.pitch > 0 ? "+" : ""}{sp.pitch}</span>
                </div>
                <Slider idx={sp.idx} value={sp.pitch} min={-6} max={6} step={1}
                  onChange={(v) => update(sp.idx, { pitch: v, characterId: null })} />
              </div>

              {/* default emotion */}
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
                </div>
              </div>

              <hr className="hr" />
              <div className="row between">
                <span className="model-tag">🧠 {(window.MODELS.find((m) => m.id === sp.model) || {}).name} · {vl.flag}{vl.short}</span>
                <Btn kind="soft" size="sm" ic="＋" onClick={() => setSaveFor(sp.idx)}>{T("saveAsCharacter")}</Btn>
              </div>
            </div>
          );
        })}
      </div>

      {/* preset bank */}
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
                {!c.builtin && (
                  <button className="preset-del" title={T("deleteVoice")} onClick={() => deleteCharacter(c.id)}>✕</button>
                )}
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
            const id = "user-" + Date.now();
            setPresets((prev) => [...prev, { id, name, desc, face: sp.face, model: sp.model, speed: sp.speed, pitch: sp.pitch, emotion: sp.emotion, lang: sp.lang, builtin: false }]);
            update(saveFor, { characterId: id });
            setSaveFor(null);
          }} />
      )}

      {newOpen !== null && (
        <NewCharacterModal
          onClose={() => setNewOpen(null)}
          onCreate={(char) => {
            setPresets((prev) => [...prev, char]);
            if (typeof newOpen === "number") applyCharacter(newOpen, char);
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
              {vl.flag}{vl.short} · {moodLabel} · {speaker.speed.toFixed(2)}× · {speaker.pitch > 0 ? "+" : ""}{speaker.pitch}
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

function NewCharacterModal({ onClose, onCreate }) {
  const T = window.tr;
  const [c, setC] = React.useState(() => window.makeCharacter());
  const set = (patch) => setC((prev) => ({ ...prev, ...patch }));
  const [previewing, setPreviewing] = React.useState(false);

  const preview = () => {
    setPreviewing(true);
    window.VoiceSynth.play({
      pitch: c.pitch, speed: c.speed, emotion: c.emotion, seed: 1,
      dur: window.estimateDur(sampleLine(c.lang, 0)),
      onEnd: () => setPreviewing(false),
    });
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide" data-spk={3} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ gap: 14, marginBottom: 18 }}>
          <div className="avatar sz-lg" data-spk={3}><span className="emoji">{c.face}</span></div>
          <div className="grow">
            <h2 style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: 22 }}>{T("newVoiceProfile")}</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{T("newVoiceProfileSub")}</p>
          </div>
          <IconBtn idx={3} tinted ic={previewing ? <MiniWave idx={3} /> : "▶"} title={T("preview")} onClick={preview} />
        </div>

        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">{T("voiceName")}</label>
            <input className="text-input" value={c.name} autoFocus
              onChange={(e) => set({ name: e.target.value })} placeholder={T("namePh2")} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">{T("description")}</label>
            <input className="text-input" value={c.desc}
              onChange={(e) => set({ desc: e.target.value })} placeholder={T("descPh2")} />
          </div>
        </div>

        <label className="field-label" style={{ marginTop: 16 }}>{T("face")}</label>
        <div className="emoji-grid">
          {FACE_CHOICES.map((f) => (
            <button key={f} className={"emoji-btn" + (c.face === f ? " on" : "")} data-spk={3}
              onClick={() => set({ face: f })}>{f}</button>
          ))}
        </div>

        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <div className="ctrl" style={{ flex: 1, marginTop: 16 }}>
            <label className="field-label">{T("localModel")}</label>
            <select className="select" data-spk={3} value={c.model} onChange={(e) => set({ model: e.target.value })}>
              {window.MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {window.modelNote(m.id)}</option>
              ))}
            </select>
          </div>
          <div className="ctrl" style={{ flex: 1, marginTop: 16 }}>
            <label className="field-label">{T("voiceLanguage")}</label>
            <select className="select" data-spk={3} value={c.lang} onChange={(e) => set({ lang: e.target.value })}>
              {window.VOICE_LANGS.map((l) => (
                <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ctrl">
          <div className="ctrl-head">
            <span className="ctrl-label">🏃 {T("pace")}</span>
            <span className="ctrl-val">{c.speed.toFixed(2)}×</span>
          </div>
          <Slider idx={3} value={c.speed} min={0.7} max={1.4} step={0.01} onChange={(v) => set({ speed: v })} />
        </div>

        <div className="ctrl">
          <div className="ctrl-head">
            <span className="ctrl-label">🎚️ {T("pitch")}</span>
            <span className="ctrl-val">{c.pitch > 0 ? "+" : ""}{c.pitch}</span>
          </div>
          <Slider idx={3} value={c.pitch} min={-6} max={6} step={1} onChange={(v) => set({ pitch: v })} />
        </div>

        <div className="ctrl">
          <div className="ctrl-head"><span className="ctrl-label">🎭 {T("defaultMood")}</span></div>
          <div className="emoji-grid">
            {window.EMOTIONS.map((e) => (
              <button key={e.id} className={"emoji-btn" + (c.emotion === e.id ? " on" : "")} data-spk={3}
                title={window.emoLabel(e.id)} onClick={() => set({ emotion: e.id })}>{e.em}</button>
            ))}
          </div>
        </div>

        <div className="row between" style={{ marginTop: 22 }}>
          <Btn kind="ghost" onClick={onClose}>{T("cancel")}</Btn>
          <Btn kind="primary" ic="✓" disabled={!c.name.trim()}
            onClick={() => onCreate({ ...c, name: c.name.trim(), desc: c.desc.trim() || T("customMix") })}>
            {T("createVoice")}
          </Btn>
        </div>
      </div>
    </div>
  );
}

window.CastScreen = CastScreen;
