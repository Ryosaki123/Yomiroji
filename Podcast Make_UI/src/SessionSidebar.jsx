/* SessionSidebar.jsx — left rail listing all podcast sessions / generations */

function SessionSidebar({ sessions, activeId, onSelect, onNew, onRename, onDelete }) {
  const T = window.tr;
  const [editing, setEditing] = React.useState(null);
  const [draft, setDraft] = React.useState("");

  const startRename = (s) => { setEditing(s.id); setDraft(s.title); };
  const commit = () => {
    if (editing) onRename(editing, draft.trim() || T("untitled"));
    setEditing(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <div className="brand-mark"><div className="bars"><i /><i /><i /><i /></div></div>
          <div className="brand-name">Y<b>app</b></div>
        </div>
        <button className="new-sess" onClick={onNew}>
          <span className="ic">＋</span> {T("newPodcast")}
        </button>
      </div>

      <div className="sidebar-section">{T("yourSessions")} · {sessions.length}</div>
      <div className="sidebar-list">
        {sessions.map((s) => {
          const ready = s.lines.length > 0 && s.lines.every((l) => l.status === "ready");
          const len = window.sessionLength(s.lines, s.speakers);
          const hasScript = (s.raw || "").trim().length > 0;
          const meta = s.lines.length
            ? (T("voicesCount", s.speakers.length) + " · " + window.fmtTime(len))
            : (hasScript ? T("draftReady") : T("emptyDraft"));
          return (
            <div key={s.id} className={"sess-item" + (s.id === activeId ? " active" : "")}
              onClick={() => onSelect(s.id)} onDoubleClick={() => startRename(s)}>
              <div className="sess-ic">
                {s.lines.length ? (
                  <span className="eqs">
                    {[10, 16, 7, 13].map((h, i) => <i key={i} style={{ height: h }} />)}
                  </span>
                ) : <span style={{ fontSize: 17 }}>📝</span>}
              </div>
              <div className="sess-main">
                {editing === s.id ? (
                  <input className="sess-rename" autoFocus value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }}
                    onClick={(e) => e.stopPropagation()} />
                ) : (
                  <div className="sess-title">{s.title}</div>
                )}
                <div className="sess-meta">
                  {ready && <span className="gdot" />}
                  {ready ? T("ready") + " · " + window.fmtTime(len) : meta}
                </div>
              </div>
              <button className="sess-del" title={T("deleteSession")}
                onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}>✕</button>
            </div>
          );
        })}
      </div>

      <div className="sidebar-foot">
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--ok)" }} />
        {T("savedOffline")}
      </div>
    </aside>
  );
}

window.SessionSidebar = SessionSidebar;
