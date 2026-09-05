// レシピの型・検証・スケーリング・URL エンコード（ブラウザ / Node 共通）

export const RECIPE_SCHEMA_VERSION = 1;

export function newId(prefix = "r") {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${rnd}`;
}

export function emptyRecipe() {
  return {
    id: newId(),
    name: "",
    author: "",
    description: "",
    coffee_g: 15,
    water_g: 225,
    temp_c: 92,
    grind: "中挽き",
    steps: [{ at_s: 0, target_g: 30, label: "蒸らし", note: "" }],
    finish_s: null,
    tags: [],
  };
}

export function ratio(recipe) {
  return recipe.coffee_g > 0 ? recipe.water_g / recipe.coffee_g : 0;
}

export function formatRatio(recipe) {
  const r = ratio(recipe);
  return r ? `1:${Number.isInteger(r) ? r : r.toFixed(1)}` : "—";
}

export function totalTime(recipe) {
  if (recipe.finish_s != null) return recipe.finish_s;
  const last = recipe.steps[recipe.steps.length - 1];
  return last ? last.at_s + 30 : 0;
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 粉量を変えたレシピを返す。湯量・各ステップの累計 g を比例スケール、秒はそのまま。 */
export function scaleRecipe(recipe, coffee_g) {
  const k = coffee_g / recipe.coffee_g;
  const roundG = (g) => Math.round(g * k);
  return {
    ...recipe,
    coffee_g,
    water_g: roundG(recipe.water_g),
    steps: recipe.steps.map((s) => ({ ...s, target_g: roundG(s.target_g) })),
  };
}

/** 検証。問題なければ空配列、あれば日本語メッセージの配列。 */
export function validateRecipe(r) {
  const errs = [];
  if (!r || typeof r !== "object") return ["レシピの形式が不正です"];
  if (!r.name || !String(r.name).trim()) errs.push("レシピ名を入れてください");
  if (!(r.coffee_g > 0)) errs.push("粉量は 0 より大きい数にしてください");
  if (!(r.water_g > 0)) errs.push("総湯量は 0 より大きい数にしてください");
  if (!Array.isArray(r.steps) || r.steps.length === 0) {
    errs.push("注湯ステップを 1 つ以上入れてください");
    return errs;
  }
  let prevT = -1, prevG = 0;
  r.steps.forEach((s, i) => {
    const n = i + 1;
    if (!(Number.isFinite(s.at_s) && s.at_s >= 0)) errs.push(`ステップ${n}: 開始秒が不正です`);
    else if (s.at_s <= prevT) errs.push(`ステップ${n}: 開始秒は前のステップより後にしてください`);
    if (!(Number.isFinite(s.target_g) && s.target_g > 0)) errs.push(`ステップ${n}: 累計 g が不正です`);
    else if (s.target_g <= prevG) errs.push(`ステップ${n}: 累計 g は前のステップより増やしてください`);
    prevT = Number.isFinite(s.at_s) ? s.at_s : prevT;
    prevG = Number.isFinite(s.target_g) ? s.target_g : prevG;
  });
  const last = r.steps[r.steps.length - 1];
  if (last && Number.isFinite(last.target_g) && r.water_g > 0 && last.target_g !== r.water_g) {
    errs.push(`最後のステップの累計 g（${last.target_g}）と総湯量（${r.water_g}）を一致させてください`);
  }
  if (r.finish_s != null && last && Number.isFinite(last.at_s) && r.finish_s <= last.at_s) {
    errs.push("落ち切り目安は最後のステップより後にしてください");
  }
  return errs;
}

/** 外部から来た JSON を安全な形に正規化する（余計なキーを落とし、型を揃える）。 */
export function normalizeRecipe(raw) {
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const str = (v, max = 400) => String(v ?? "").slice(0, max);
  return {
    id: str(raw.id || newId(), 60),
    name: str(raw.name, 60),
    author: str(raw.author, 80),
    description: str(raw.description, 600),
    coffee_g: num(raw.coffee_g),
    water_g: num(raw.water_g),
    temp_c: raw.temp_c == null || raw.temp_c === "" ? null : num(raw.temp_c),
    grind: str(raw.grind, 40),
    steps: (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 30).map((s) => ({
      at_s: num(s.at_s),
      target_g: num(s.target_g),
      label: str(s.label, 40),
      note: str(s.note, 200),
    })),
    finish_s: raw.finish_s == null || raw.finish_s === "" ? null : num(raw.finish_s),
    tags: (Array.isArray(raw.tags) ? raw.tags : []).slice(0, 10).map((t) => str(t, 20)),
  };
}

// ---- URL 共有用エンコード ------------------------------------------------
// 形式: 先頭1文字が方式。"z" = deflate-raw + base64url、"j" = base64url のみ。

const te = new TextEncoder();
const td = new TextDecoder();

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipeBytes(bytes, stream) {
  const resp = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await resp.arrayBuffer());
}

/** 共有用ペイロード。id は受け取り側で振り直すため含めない。 */
function sharePayload(recipe) {
  const { id, ...rest } = recipe;
  return { v: RECIPE_SCHEMA_VERSION, ...rest };
}

export async function encodeRecipe(recipe) {
  const json = te.encode(JSON.stringify(sharePayload(recipe)));
  if (typeof CompressionStream === "function") {
    try {
      const z = await pipeBytes(json, new CompressionStream("deflate-raw"));
      return "z" + b64urlEncode(z);
    } catch { /* フォールバックへ */ }
  }
  return "j" + b64urlEncode(json);
}

export async function decodeRecipe(encoded) {
  const mode = encoded[0];
  const body = b64urlDecode(encoded.slice(1));
  let json;
  if (mode === "z") {
    if (typeof DecompressionStream !== "function") throw new Error("この端末は圧縮形式の URL を開けません");
    json = await pipeBytes(body, new DecompressionStream("deflate-raw"));
  } else if (mode === "j") {
    json = body;
  } else {
    throw new Error("URL の形式が不明です");
  }
  const raw = JSON.parse(td.decode(json));
  const recipe = normalizeRecipe({ ...raw, id: newId("s") });
  const errs = validateRecipe(recipe);
  if (errs.length) throw new Error("レシピに問題があります: " + errs[0]);
  return recipe;
}

export function shareUrl(baseUrl, encoded) {
  const u = new URL(baseUrl);
  u.hash = "r=" + encoded;
  return u.toString();
}

export function parseShareHash(hash) {
  const m = /^#?r=([A-Za-z0-9_\-]+)$/.exec(hash || "");
  return m ? m[1] : null;
}
