/* api.jsx — thin client for the local FastAPI backend (same origin, offline). */

async function _post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || ("HTTP " + res.status));
  return data;
}
async function _get(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || ("HTTP " + res.status));
  return data;
}

// read a File -> base64 data (for voice upload, no multipart dependency)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

window.Api = {
  getModels: () => _get("/api/models"),
  getVoices: () => _get("/api/voices"),
  previewVoice: (body) => _post("/api/voice/preview", body),
  saveVoice: (body) => _post("/api/voices", body),
  updateVoice: (id, body) => fetch("/api/voices/" + encodeURIComponent(id), {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
  }).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || d.detail || ("HTTP " + r.status)); return d; }),
  deleteVoice: (id) => fetch("/api/voices/" + encodeURIComponent(id), { method: "DELETE" }).then((r) => r.json()),
  synthLine: (body) => _post("/api/line/synth", body),
  render: (body) => _post("/api/podcast/render", body),
  jobStatus: (id) => _get("/api/jobs/" + encodeURIComponent(id)),
  activeJob: (sessionId) => _get("/api/jobs/active?sessionId=" + encodeURIComponent(sessionId)),
  editLine: (body) => _post("/api/line/edit", body),
  freeModels: () => _post("/api/models/free", {}),
  fileToBase64,
};
