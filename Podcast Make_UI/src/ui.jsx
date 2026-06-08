/* ui.jsx — shared primitives */

function Avatar({ idx, face, size = "md", ring = false }) {
  return (
    <div className={"avatar sz-" + size + (ring ? " ring" : "")} data-spk={idx}>
      <span className="emoji">{face}</span>
    </div>
  );
}

function Btn({ kind = "ghost", size, ic, children, ...rest }) {
  const cls = ["btn", "btn-" + kind, size ? "btn-" + size : ""].join(" ").trim();
  return (
    <button className={cls} {...rest}>
      {ic && <span className="ic">{ic}</span>}
      {children}
    </button>
  );
}

function IconBtn({ ic, tinted, idx, title, onClick, ...rest }) {
  return (
    <button className={"icon-btn" + (tinted ? " tinted" : "")} data-spk={idx} title={title} onClick={onClick} {...rest}>
      {ic}
    </button>
  );
}

function Slider({ idx, value, min, max, step, onChange }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range" className="slider" data-spk={idx}
      min={min} max={max} step={step} value={value}
      style={{ "--fill": fill + "%" }}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  );
}

// animated equalizer bars
function MiniWave({ idx }) {
  return (
    <span className="mini-wave" data-spk={idx}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} style={{ animationDelay: i * 0.11 + "s", height: 4 + (i % 3) * 4 + "px" }} />
      ))}
    </span>
  );
}

function ModelChip({ model }) {
  const m = (window.MODELS || []).find((x) => x.id === model) || window.MODELS[0];
  return (
    <span className="model-tag">🧠 {m.name}</span>
  );
}

function Toast({ children }) {
  return <div className="toast">{children}</div>;
}

Object.assign(window, { Avatar, Btn, IconBtn, Slider, MiniWave, ModelChip, Toast });
