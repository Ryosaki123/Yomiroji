/* data.jsx — sample script, characters/presets, local models, emotions */

// App display name (single source of truth — used by the sidebar logo + tab title).
window.APP_NAME = "Yomiroji";

// Real local Irodori-TTS models (hydrated from the backend at boot in app.jsx;
// this is the fallback before /api/models responds).
window.MODELS = [
  { id: "base",        name: "Irodori Base v3",     role: "render", note: "voice cloning" },
  { id: "voicedesign", name: "Irodori VoiceDesign", role: "design", note: "design from a prompt" },
];

// Emotion / tone tokens (emoji-first per user request)
window.EMOTIONS = [
  { id: "neutral",  em: "🙂", label: "Neutral" },
  { id: "excited",  em: "😄", label: "Excited" },
  { id: "curious",  em: "🤔", label: "Curious" },
  { id: "calm",     em: "😌", label: "Calm" },
  { id: "playful",  em: "😏", label: "Playful" },
  { id: "surprise", em: "😮", label: "Surprised" },
  { id: "warm",     em: "🥰", label: "Warm" },
  { id: "serious",  em: "🧐", label: "Serious" },
  { id: "whisper",  em: "🤫", label: "Whisper" },
  { id: "sad",      em: "🥺", label: "Tender" },
];
window.NONE_EMOTION = { id: "none", em: "🚫", label: "None" };
window.emotionById = (id) =>
  (id === "none" ? window.NONE_EMOTION : (window.EMOTIONS.find((e) => e.id === id) || window.EMOTIONS[0]));

// Voice "characters" (presets) come from the backend voice library (each backed
// by a reference WAV that Base v3 clones). Empty until app.jsx hydrates it.
window.PRESET_CHARACTERS = [];

// Map a backend voice profile -> the character shape the UI uses.
// `speed` = pace, `cfg` = cfg_scale_speaker (voice strength). Pitch is unused
// (Base v3 has no pitch control) but kept at 0 for the shared UI shape.
window.voiceToCharacter = function voiceToCharacter(v) {
  return {
    id: v.id, voiceId: v.id, name: v.name, face: v.face || "🎙️",
    desc: v.desc || "", model: "base", lang: v.language || "ja",
    speed: v.pace != null ? v.pace : 1.0, pitch: 0,
    cfg: v.cfg_scale_speaker != null ? v.cfg_scale_speaker : 5.0,
    steps: v.num_steps != null ? v.num_steps : 45,
    emotion: v.emotion || "neutral", wavUrl: v.wavUrl || null,
    builtin: !!v.builtin,
  };
};

// Sample script — playful food-debate podcast, 3 speakers (English)
window.SAMPLE_SCRIPT = `MAYA: Welcome back to Crumbs — the show where we argue about food that absolutely does not matter. I'm Maya.
DEV: And I'm Dev, here to lose another argument with confidence.
MAYA: Today's burning question... is a hot dog a sandwich?
DEV: Absolutely not. It's its own category. A tube food.
MAYA: A "tube food"? That is not a real classification, Dev.
DEV: It is now. I just classified it. Live, on air.
PERCY: If I may interject as the resident food historian —
MAYA: Percy! We forgot you were here.
PERCY: The sandwich, by definition, requires two distinct pieces of bread.
DEV: See? Two pieces. A hot dog bun is one piece. Case closed.
MAYA: That's the most reasonable thing you've said all year.
DEV: Don't get used to it.
PERCY: So we are agreed. The hot dog is a taco.
MAYA: ...okay, that's the show. Thanks for listening to Crumbs.`;

// Japanese sample — same playful food-debate vibe
window.SAMPLE_JA = `マヤ：おかえりなさい、グルメ討論へ。どうでもいい食べ物について本気で言い争う番組です。司会のマヤです。
ケン：相方のケンです。今日も自信を持って負けにいきます。
マヤ：さて今日のお題は……たい焼きはケーキなのか？
ケン：いや、たい焼きは断じて和菓子だよ。ケーキじゃない。
マヤ：でも生地を焼いて、中に詰め物。ケーキの定義に近くない？
ケン：その理屈だと、たこ焼きもケーキになっちゃうよ。
ハル：失礼、ここで食の歴史家として一言よろしいですか。
マヤ：ハル！いたの忘れてた。
ハル：本来ケーキとは、小麦の生地を焼いた菓子を指します。
ケン：ほら、生地を焼いてる。つまりたい焼きはケーキだ。
マヤ：あれ、さっきと言ってること逆じゃない？
ハル：というわけで結論。たい焼きはタコスです。
マヤ：……はい、今日はここまで。ご清聴ありがとうございました。`;

// Parse a "SPEAKER: text" script into speakers + lines.
window.parseScript = function parseScript(raw) {
  const lines = [];
  const speakerOrder = [];
  const rx = /^\s*([A-Za-z\u3040-\u30FF\u4E00-\u9FFF\uFF66-\uFF9D][^:：\n]{0,23}?)\s*[:：]\s*(.+)$/;
  raw.split(/\n+/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const m = line.match(rx);
    let name, text;
    if (m) { name = m[1].trim(); text = m[2].trim(); }
    else { name = speakerOrder[speakerOrder.length - 1] || "Speaker 1"; text = line; }
    const key = name.toUpperCase();
    if (!speakerOrder.some((s) => s.toUpperCase() === key)) speakerOrder.push(name);
    lines.push({ speaker: name, text });
  });
  // cap speakers at 4 — extras fold into the 4th
  const top = speakerOrder.slice(0, 4);
  const idxOf = (nm) => {
    const i = top.findIndex((s) => s.toUpperCase() === nm.toUpperCase());
    return i === -1 ? top.length - 1 : i;
  };
  return {
    speakers: top.map((nm, i) => ({ id: "spk" + i, name: titleCase(nm), label: nm, idx: i })),
    lines: lines.map((l, i) => ({
      id: "L" + i,
      spk: idxOf(l.speaker),
      text: l.text,
      emotion: null,        // null => inherit from character
      pauseAfter: 0.2,      // seconds (default pause after each line)
      status: "idle",       // idle | gen | ready | edited
      dur: estimateDur(l.text),
    })),
  };
};

function titleCase(s) {
  // only title-case ASCII words; leave Japanese/other scripts untouched
  return s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
// rough seconds estimate from text (≈ 165 wpm for latin, ≈ 7 chars/sec for CJK)
window.estimateDur = function estimateDur(text) {
  const t = (text || "").trim();
  const cjkRx = /[\u3040-\u30FF\u4E00-\u9FFF\uFF66-\uFF9D]/g;
  const cjk = (t.match(cjkRx) || []).length;
  const latin = (t.replace(cjkRx, " ").match(/\S+/g) || []).length;
  const sec = (latin / 165) * 60 + cjk / 7.0;
  return Math.max(1.0, +sec.toFixed(1));
};
function estimateDur(t) { return window.estimateDur(t); }

window.fmtTime = function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
};

// total spoken length of a set of lines given speaker configs
window.sessionLength = function sessionLength(lines, speakers) {
  return (lines || []).reduce((sum, l) => {
    const sp = (speakers || [])[l.spk] || {};
    const speed = sp.speed || 1;
    return sum + Math.max(0.5, (l.dur || 1.5) / speed) + (l.pauseAfter || 0);
  }, 0);
};

let __sid = 0;
function uid(p) { __sid++; return p + Date.now().toString(36) + __sid.toString(36); }

// a podcast project / generation
window.makeSession = function makeSession(over) {
  over = over || {};
  return {
    id: uid("s"),
    title: "Untitled podcast",
    createdAt: Date.now(), updatedAt: Date.now(),
    step: "script", raw: "", speakers: [], lines: [],
    ...over,
  };
};

// a blank voice profile for the "new voice" builder
window.makeCharacter = function makeCharacter(over) {
  return {
    id: uid("v"), name: "New voice", desc: "Custom voice", face: "\uD83C\uDF99\uFE0F",
    model: "base", speed: 1.0, pitch: 0, cfg: 5.0, steps: 45, emotion: "neutral",
    lang: "ja", builtin: false,
    ...(over || {}),
  };
};

// auto-title from detected speakers
window.titleFromSpeakers = function titleFromSpeakers(speakers) {
  const names = (speakers || []).map((s) => s.name);
  if (!names.length) return window.tr ? window.tr("untitled") : "Untitled podcast";
  const ja = window.__uiLang === "ja";
  if (names.length === 1) return ja ? (names[0] + "のポッドキャスト") : (names[0] + "\u2019s podcast");
  const sep = ja ? "、" : ", ";
  const amp = ja ? "と" : " & ";
  if (names.length === 2) return names[0] + amp + names[1];
  return names.slice(0, -1).join(sep) + amp + names[names.length - 1];
};

// ---- persistence ----
window.YAPP_KEY = "yapp.studio.v3";
window.loadState = function loadState() {
  try { return JSON.parse(localStorage.getItem(window.YAPP_KEY) || "null"); } catch (e) { return null; }
};
window.saveState = function saveState(st) {
  try { localStorage.setItem(window.YAPP_KEY, JSON.stringify(st)); } catch (e) {}
};
