import {
  emptyRecipe, newId, formatRatio, formatTime, totalTime, scaleRecipe, validateRecipe, normalizeRecipe,
  encodeRecipe, decodeRecipe, shareUrl, parseShareHash,
} from "./recipe.js";
import { BrewTimer, locate } from "./timer.js";
import { sound } from "./audio.js";
import { storage } from "./storage.js";
import { createWeightSource } from "./weight-source.js";

// ---- 文字列（後で多言語化しやすいよう 1 箇所に） ----------------------------
const T = {
  appTitle: "ドリップタイマー",
  builtin: "公式レシピ", mine: "マイレシピ", newRecipe: "新しいレシピを作る",
  brew: "淹れる", share: "共有", edit: "編集", duplicate: "複製して編集", delete: "削除",
  ratio: "比率", time: "時間", pours: "注湯", temp: "湯温", grind: "挽き目",
  dose: "粉量", water: "総湯量",
  start: "スタート", pause: "一時停止", resume: "再開", reset: "リセット", finishBrew: "終了してメモ",
  ready: "準備できたらスタート", nextPour: "次の注湯まで", finishIn: "落ち切り目安まで", done: "抽出完了",
  memoTitle: "抽出メモ", bean: "豆", rating: "評価", memo: "メモ・感想", save: "保存", skip: "保存せずに戻る",
  history: "履歴", noHistory: "まだ履歴がありません。淹れ終わると、ここに記録が残ります。", brewAgain: "もう一度淹れる",
  settings: "設定", soundOn: "合図音", wakeLock: "抽出中は画面を消さない", export: "バックアップを書き出す", import: "バックアップを読み込む",
  about: "このアプリについて",
  shareTitle: "レシピを共有", shareHint: "URL か QR を渡すと、相手の端末に同じレシピが入ります。", copy: "URL をコピー", copied: "コピーしました", shareSheet: "共有…",
  importTitle: "レシピを取り込みますか？", importOk: "取り込む", cancel: "キャンセル", imported: "マイレシピに追加しました",
  editorNew: "新しいレシピ", editorEdit: "レシピを編集", name: "レシピ名", author: "作者", description: "説明・コツ",
  stepsTitle: "注湯ステップ", addStep: "ステップを追加", atS: "開始(秒)", targetG: "累計 g", label: "名前", finishS: "落ち切り目安（秒・任意）",
  saved: "保存しました", deleted: "削除しました", confirmDelete: "このレシピを削除しますか？", confirmDeleteLog: "この記録を削除しますか？",
  wakeLockNA: "この端末では画面消灯を止められません。自動ロックを長めに設定してください。",
  scaleHint: "スケールの表示をこの数字に合わせて注ぎます",
};

// ---- 状態 -------------------------------------------------------------
const $ = (sel, el = document) => el.querySelector(sel);
const view = $("#view"), tabbar = $("#tabbar"), title = $("#topbar-title"), btnBack = $("#btn-back"), btnMenu = $("#btn-menu");
const state = { builtin: [], route: "home", params: {}, dose: {}, brew: null };
const BASE_URL = new URL(".", location.href).toString();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 1800); };

function allRecipes() { return [...state.builtin, ...storage.getRecipes()]; }
function findRecipe(id) { return allRecipes().find((r) => r.id === id); }
function isBuiltin(r) { return state.builtin.some((b) => b.id === r.id); }

// ---- ルーティング ------------------------------------------------------
function navigate(route, params = {}, { replace = false } = {}) {
  stopBrewLoop();
  state.route = route; state.params = params;
  const entry = { route, params };
  if (replace) history.replaceState(entry, ""); else history.pushState(entry, "");
  render();
}
addEventListener("popstate", (e) => {
  if (state.route === "brew" && state.brew?.timer.running) { state.brew.timer.pause(); }
  stopBrewLoop();
  const s = e.state || { route: "home", params: {} };
  state.route = s.route; state.params = s.params; render();
});
btnBack.addEventListener("click", () => history.back());
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.route)));

function chrome({ titleText, back = false, tabs = true, menu = null }) {
  title.textContent = titleText;
  btnBack.hidden = !back;
  tabbar.hidden = !tabs;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.route === state.route));
  btnMenu.hidden = !menu;
  btnMenu.onclick = menu;
}

function render() {
  view.scrollTop = 0; window.scrollTo(0, 0);
  const r = state.route;
  if (r === "home") renderHome();
  else if (r === "detail") renderDetail();
  else if (r === "brew") renderBrew();
  else if (r === "memo") renderMemo();
  else if (r === "history") renderHistory();
  else if (r === "editor") renderEditor();
  else if (r === "settings") renderSettings();
  else renderHome();
}

// ---- ホーム -----------------------------------------------------------
function recipeCard(r) {
  return `<button class="card recipe-card" data-id="${esc(r.id)}">
    <div class="name">${esc(r.name)}</div>
    <div class="meta"><span>${T.ratio} <b>${formatRatio(r)}</b></span><span>${T.time} <b class="num">${formatTime(totalTime(r))}</b></span><span>${T.pours} <b>${r.steps.length}回</b></span></div>
    ${r.author ? `<div class="author">${esc(r.author)}</div>` : ""}
  </button>`;
}
function renderHome() {
  chrome({ titleText: T.appTitle });
  const mine = storage.getRecipes();
  view.innerHTML = `
    <div class="section-title">${T.builtin}</div>
    ${state.builtin.map(recipeCard).join("")}
    <div class="section-title">${T.mine}</div>
    ${mine.length ? mine.map(recipeCard).join("") : `<div class="card hint">まだありません。公式レシピを「${T.duplicate}」して自分の配合にするか、共有された URL を開くとここに入ります。</div>`}
    <div class="btn-row"><button class="btn secondary block" id="btn-new">＋ ${T.newRecipe}</button></div>`;
  view.querySelectorAll(".recipe-card").forEach((b) => b.addEventListener("click", () => navigate("detail", { id: b.dataset.id })));
  $("#btn-new").addEventListener("click", () => navigate("editor", {}));
}

// ---- 詳細 -------------------------------------------------------------
function currentDose(r) { return state.dose[r.id] ?? r.coffee_g; }
function renderDetail() {
  const base = findRecipe(state.params.id);
  if (!base) return navigate("home", {}, { replace: true });
  const builtin = isBuiltin(base);
  chrome({ titleText: base.name, back: true, tabs: false });
  const draw = () => {
    const dose = currentDose(base);
    const r = scaleRecipe(base, dose);
    view.innerHTML = `
      <div class="hero">
        <h2>${esc(r.name)}</h2>
        ${r.author ? `<div class="author">${esc(r.author)}</div>` : ""}
        ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ""}
        <div class="stats">
          <div class="stat"><div class="v">${formatRatio(r)}</div><div class="k">${T.ratio}</div></div>
          <div class="stat"><div class="v num">${formatTime(totalTime(r))}</div><div class="k">${T.time}</div></div>
          <div class="stat"><div class="v">${r.steps.length}<small>回</small></div><div class="k">${T.pours}</div></div>
          <div class="stat"><div class="v">${r.temp_c != null ? r.temp_c + "℃" : "—"}</div><div class="k">${T.temp}</div></div>
        </div>
      </div>
      <div class="card dose">
        <div class="dose-head"><div><div class="hint">${T.dose}${r.grind ? `・${esc(r.grind)}` : ""}</div><div class="v num">${dose}<small>g</small></div></div>
          <div style="text-align:right"><div class="hint">${T.water}</div><div class="v num">${r.water_g}<small>g</small></div></div></div>
        <input type="range" id="dose" min="6" max="60" step="1" value="${dose}" aria-label="${T.dose}">
      </div>
      <div class="card steps">
        ${r.steps.map((s) => `<div class="step-row"><div class="t num">${formatTime(s.at_s)}</div><div><div class="l">${esc(s.label) || `${T.pours}`}</div>${s.note ? `<div class="n">${esc(s.note)}</div>` : ""}</div><div class="g num">${s.target_g}<small>g</small></div></div>`).join("")}
        ${r.finish_s != null ? `<div class="step-row"><div class="t num">${formatTime(r.finish_s)}</div><div class="l" style="color:var(--ink-3)">落ち切り目安</div><div></div></div>` : ""}
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="btn-share">${T.share}</button>
        <button class="btn ghost" id="btn-edit">${builtin ? T.duplicate : T.edit}</button>
        ${builtin ? "" : `<button class="btn danger" id="btn-del">${T.delete}</button>`}
      </div>
      <div style="height:84px"></div>
      <div class="actions-fixed"><button class="btn block" id="btn-brew">☕ ${T.brew}</button></div>`;
    const slider = $("#dose");
    slider.addEventListener("input", () => {
      state.dose[base.id] = Number(slider.value);
      const rr = scaleRecipe(base, Number(slider.value));
      $(".dose-head .v.num").innerHTML = `${slider.value}<small>g</small>`;
      view.querySelectorAll(".dose-head .v.num")[1].innerHTML = `${rr.water_g}<small>g</small>`;
      view.querySelectorAll(".step-row .g").forEach((el, i) => { if (rr.steps[i]) el.innerHTML = `${rr.steps[i].target_g}<small>g</small>`; });
    });
    $("#btn-brew").addEventListener("click", () => { sound.unlock(); navigate("brew", { id: base.id }); });
    $("#btn-share").addEventListener("click", () => openShare(r));
    $("#btn-edit").addEventListener("click", () => navigate("editor", builtin ? { from: base.id } : { id: base.id }));
    $("#btn-del")?.addEventListener("click", async () => { if (await confirmDialog(T.confirmDelete)) { storage.deleteRecipe(base.id); toast(T.deleted); navigate("home", {}, { replace: true }); } });
  };
  draw();
}

// ---- ブルー画面 -------------------------------------------------------
let loopId = 0, wakeLock = null;
function stopBrewLoop() { clearInterval(loopId); loopId = 0; releaseWakeLock(); }
function startBrewLoop(fn) { clearInterval(loopId); loopId = setInterval(fn, 100); }
async function requestWakeLock() {
  if (!storage.getSettings().wakeLock) return;
  try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); else toast(T.wakeLockNA); } catch { /* ignore */ }
}
function releaseWakeLock() { try { wakeLock?.release(); } catch {} wakeLock = null; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state.brew?.timer.running) requestWakeLock(); });

function renderBrew() {
  const base = findRecipe(state.params.id);
  if (!base) return navigate("home", {}, { replace: true });
  const r = scaleRecipe(base, currentDose(base));
  chrome({ titleText: r.name, back: true, tabs: false });
  const timer = new BrewTimer();
  const b = state.brew = { recipe: r, timer, announced: -1, ticked: new Set(), finished: false };
  const source = createWeightSource("manual");

  view.innerHTML = `<div class="brew">
    <div class="elapsed num"><span class="cap">経過</span><span id="el">0:00</span></div>
    <div class="target" id="target">
      <div class="label" id="tlabel">${T.ready}</div>
      <div class="g num"><span id="tg">0</span><small>g</small></div>
      <div class="note" id="tnote">${T.scaleHint}</div>
    </div>
    <div class="next"><div><div class="k" id="nk">${T.nextPour}</div><div class="to" id="nto">${esc(r.steps[0]?.label || "")} → <span class="num">${r.steps[0]?.target_g ?? 0}</span> g</div></div><div class="v num" id="nv">—</div></div>
    <div class="bar" id="bar"><i></i>${r.steps.map((s) => `<b style="left:${(s.at_s / totalTime(r)) * 100}%"></b>`).join("")}</div>
    <div class="list" id="list">${r.steps.map((s, i) => `<div class="li" data-i="${i}"><span>${i + 1}</span><span class="num">${formatTime(s.at_s)}</span><span>${esc(s.label)}</span><span class="g num">${s.target_g} g</span></div>`).join("")}</div>
    <div class="weight" id="weight" hidden></div>
    <div class="controls">
      <button class="btn ghost" id="btn-reset">${T.reset}</button>
      <button class="btn" id="btn-start">${T.start}</button>
    </div>
    <div class="btn-row"><button class="btn secondary block" id="btn-finish" hidden>${T.finishBrew}</button></div>
  </div>`;

  const el = { el: $("#el"), tlabel: $("#tlabel"), tg: $("#tg"), tnote: $("#tnote"), nk: $("#nk"), nto: $("#nto"), nv: $("#nv"), bar: $("#bar > i"), target: $("#target"), start: $("#btn-start"), finish: $("#btn-finish"), weight: $("#weight") };
  const total = totalTime(r);

  source.onWeight((g) => { el.weight.hidden = false; el.weight.textContent = `現在 ${g.toFixed(1)} g`; });

  const flash = () => { el.target.classList.add("flash"); setTimeout(() => el.target.classList.remove("flash"), 600); };

  function draw() {
    const t = timer.elapsedS;
    const loc = locate(r, t);
    el.el.textContent = formatTime(t);
    el.bar.style.width = `${Math.min(100, (t / total) * 100)}%`;
    if (loc.step) {
      el.tlabel.textContent = `${loc.index + 1}/${r.steps.length}　${loc.step.label || T.pours}`;
      el.tg.textContent = loc.targetG;
      el.tnote.textContent = loc.step.note || "";
    }
    if (loc.next) {
      el.nk.textContent = T.nextPour;
      el.nto.innerHTML = `${esc(loc.next.label)} → <span class="num">${loc.next.target_g}</span> g`;
    } else if (r.finish_s != null && !loc.done) {
      el.nk.textContent = T.finishIn; el.nto.textContent = "";
    } else { el.nk.textContent = T.done; el.nto.textContent = ""; }
    if (loc.remainToNext != null && !loc.done) {
      const rem = Math.ceil(loc.remainToNext);
      el.nv.textContent = formatTime(rem);
      el.nv.classList.toggle("soon", loc.next != null && rem <= 5);
    } else { el.nv.textContent = "✓"; el.nv.classList.remove("soon"); }
    view.querySelectorAll(".li").forEach((li, i) => { li.classList.toggle("done", i < loc.index); li.classList.toggle("now", i === loc.index); });

    // 合図: 次ステップ 3,2,1 秒前のカウント、開始でポーン、終了でメロディ
    if (timer.running) {
      if (loc.next) {
        const rem = loc.next.at_s - t;
        for (const k of [3, 2, 1]) { const key = `${loc.index + 1}:${k}`; if (rem <= k && rem > k - 1 && !b.ticked.has(key)) { b.ticked.add(key); sound.tick(); } }
      }
      if (loc.index > b.announced) {
        if (b.announced >= 0 || loc.index > 0) { sound.pour(); flash(); }
        b.announced = loc.index;
      }
      if (loc.done && !b.finished) { b.finished = true; sound.finish(); flash(); timer.pause(); el.start.textContent = T.resume; stopBrewLoop(); }
    }
    if (loc.index >= r.steps.length - 1) el.finish.hidden = false;
  }

  el.start.addEventListener("click", () => {
    sound.unlock();
    if (timer.running) { timer.pause(); el.start.textContent = T.resume; stopBrewLoop(); }
    else {
      const first = timer.elapsedMs === 0;
      timer.start(); el.start.textContent = T.pause; requestWakeLock();
      if (first) { b.announced = 0; flash(); sound.pour(); }
      startBrewLoop(draw);
    }
    draw();
  });
  $("#btn-reset").addEventListener("click", () => {
    timer.reset(); b.announced = -1; b.ticked.clear(); b.finished = false; el.start.textContent = T.start; el.finish.hidden = true;
    el.tlabel.textContent = T.ready; el.tg.textContent = "0"; el.tnote.textContent = T.scaleHint; releaseWakeLock(); stopBrewLoop(); draw();
  });
  el.finish.addEventListener("click", () => { timer.pause(); const elapsed = timer.elapsedS; stopBrewLoop(); navigate("memo", { id: base.id, coffee_g: r.coffee_g, water_g: r.water_g, elapsed_s: Math.round(elapsed) }); });
  draw();
}

// ---- 抽出メモ ---------------------------------------------------------
function renderMemo() {
  const base = findRecipe(state.params.id);
  chrome({ titleText: T.memoTitle, back: false, tabs: false });
  const last = storage.getLogs().find((l) => l.recipe_id === state.params.id);
  let rating = 0;
  view.innerHTML = `
    <div class="card">
      <div class="hint">${esc(base?.name || "")}　${state.params.coffee_g} g / ${state.params.water_g} g　${formatTime(state.params.elapsed_s || 0)}</div>
      <div class="field"><label>${T.bean}</label><input class="input" id="m-bean" placeholder="例: エチオピア イルガチェフェ 浅煎り" value="${esc(last?.bean || "")}"></div>
      <div class="grid-2">
        <div class="field"><label>${T.grind}</label><input class="input" id="m-grind" placeholder="例: 中粗挽き / 目盛 4" value="${esc(last?.grind || base?.grind || "")}"></div>
        <div class="field"><label>${T.temp}（℃）</label><input class="input" id="m-temp" type="number" inputmode="numeric" value="${esc(last?.temp_c ?? base?.temp_c ?? "")}"></div>
      </div>
      <div class="field"><label>${T.rating}</label><div class="stars" id="stars">${[1,2,3,4,5].map((n) => `<button data-n="${n}" aria-label="${n}">★</button>`).join("")}</div></div>
      <div class="field"><label>${T.memo}</label><textarea class="input" id="m-memo" placeholder="味の印象、次に変えたいこと"></textarea></div>
      <div class="btn-row"><button class="btn block" id="m-save">${T.save}</button></div>
      <div class="btn-row"><button class="btn ghost block" id="m-skip">${T.skip}</button></div>
    </div>`;
  const stars = view.querySelectorAll("#stars button");
  stars.forEach((s) => s.addEventListener("click", () => { rating = Number(s.dataset.n); stars.forEach((x) => x.classList.toggle("on", Number(x.dataset.n) <= rating)); }));
  $("#m-save").addEventListener("click", () => {
    storage.saveLog({
      id: newId("log"), recipe_id: state.params.id, recipe_name: base?.name || "", coffee_g: state.params.coffee_g, water_g: state.params.water_g,
      elapsed_s: state.params.elapsed_s, brewed_at: new Date().toISOString(),
      bean: $("#m-bean").value.trim(), grind: $("#m-grind").value.trim(), temp_c: $("#m-temp").value === "" ? null : Number($("#m-temp").value),
      rating, memo: $("#m-memo").value.trim(),
    });
    toast(T.saved); navigate("history", {}, { replace: true });
  });
  $("#m-skip").addEventListener("click", () => navigate("home", {}, { replace: true }));
}

// ---- 履歴 -------------------------------------------------------------
function fmtDate(iso) { const d = new Date(iso); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function renderHistory() {
  chrome({ titleText: T.history });
  const logs = storage.getLogs();
  if (!logs.length) { view.innerHTML = `<div class="empty">${T.noHistory}</div>`; return; }
  view.innerHTML = logs.map((l) => `<div class="card log" data-id="${esc(l.id)}">
      <div class="head"><span class="name">${esc(l.recipe_name)}</span><span class="date">${fmtDate(l.brewed_at)}</span></div>
      <div class="meta"><span class="num">${l.coffee_g} g / ${l.water_g} g</span>${l.bean ? `<span>${esc(l.bean)}</span>` : ""}${l.grind ? `<span>${esc(l.grind)}</span>` : ""}${l.temp_c != null ? `<span>${l.temp_c}℃</span>` : ""}${l.rating ? `<span class="stars ro"><span>${"★".repeat(l.rating)}</span></span>` : ""}</div>
      ${l.memo ? `<div class="memo">${esc(l.memo)}</div>` : ""}
      <div class="btn-row"><button class="btn small secondary" data-act="again">${T.brewAgain}</button><button class="btn small danger" data-act="del">${T.delete}</button></div>
    </div>`).join("");
  view.querySelectorAll(".log").forEach((card) => {
    const l = logs.find((x) => x.id === card.dataset.id);
    card.querySelector('[data-act="again"]').addEventListener("click", () => {
      const r = findRecipe(l.recipe_id);
      if (!r) return toast("このレシピは削除されています");
      state.dose[r.id] = l.coffee_g; navigate("detail", { id: r.id });
    });
    card.querySelector('[data-act="del"]').addEventListener("click", async () => { if (await confirmDialog(T.confirmDeleteLog)) { storage.deleteLog(l.id); renderHistory(); } });
  });
}

// ---- エディタ ---------------------------------------------------------
function renderEditor() {
  const editing = state.params.id ? findRecipe(state.params.id) : null;
  const from = state.params.from ? findRecipe(state.params.from) : null;
  const draft = editing ? structuredClone(editing) : from ? { ...structuredClone(from), id: newId(), name: `${from.name}（自分用）`, author: "" } : emptyRecipe();
  chrome({ titleText: editing ? T.editorEdit : T.editorNew, back: true, tabs: false });

  const drawSteps = () => {
    $("#steps").innerHTML = `<div class="edit-head"><span>${T.atS}</span><span>${T.targetG}</span><span>${T.label}</span><span></span></div>` +
      draft.steps.map((s, i) => `<div class="edit-step" data-i="${i}">
        <input class="input num" type="number" inputmode="numeric" data-k="at_s" value="${s.at_s}">
        <input class="input num" type="number" inputmode="numeric" data-k="target_g" value="${s.target_g}">
        <input class="input" data-k="label" value="${esc(s.label)}" placeholder="${i === 0 ? "蒸らし" : `${i}回目`}">
        <button class="rm" aria-label="${T.delete}" ${draft.steps.length <= 1 ? "disabled" : ""}>×</button>
      </div>`).join("");
    $("#steps").querySelectorAll(".edit-step").forEach((row) => {
      const i = Number(row.dataset.i);
      row.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => { draft.steps[i][inp.dataset.k] = inp.type === "number" ? Number(inp.value) : inp.value; }));
      row.querySelector(".rm").addEventListener("click", () => { draft.steps.splice(i, 1); drawSteps(); });
    });
  };

  view.innerHTML = `
    <div class="card">
      <div class="field"><label>${T.name}</label><input class="input" id="e-name" value="${esc(draft.name)}" placeholder="例: 朝のV60 1杯分"></div>
      <div class="field"><label>${T.author}</label><input class="input" id="e-author" value="${esc(draft.author)}" placeholder="あなたの名前（任意）"></div>
      <div class="field"><label>${T.description}</label><textarea class="input" id="e-desc" placeholder="注ぎ方のコツ、味の狙いなど">${esc(draft.description)}</textarea></div>
      <div class="grid-2">
        <div class="field"><label>${T.dose}（g）</label><input class="input num" id="e-coffee" type="number" inputmode="decimal" step="0.5" value="${draft.coffee_g}"></div>
        <div class="field"><label>${T.water}（g）</label><input class="input num" id="e-water" type="number" inputmode="numeric" value="${draft.water_g}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>${T.temp}（℃）</label><input class="input num" id="e-temp" type="number" inputmode="numeric" value="${draft.temp_c ?? ""}"></div>
        <div class="field"><label>${T.grind}</label><input class="input" id="e-grind" value="${esc(draft.grind)}" placeholder="例: 中挽き"></div>
      </div>
    </div>
    <div class="section-title">${T.stepsTitle}</div>
    <div class="card">
      <div class="hint">累計 g は「その注湯が終わった時点のスケールの数字」。最後は総湯量と同じにします。</div>
      <div id="steps"></div>
      <div class="btn-row"><button class="btn small secondary" id="e-add">＋ ${T.addStep}</button></div>
      <div class="field"><label>${T.finishS}</label><input class="input num" id="e-finish" type="number" inputmode="numeric" value="${draft.finish_s ?? ""}" placeholder="例: 210"></div>
    </div>
    <div class="error" id="e-err" style="margin:12px 4px"></div>
    <div class="btn-row"><button class="btn ghost" id="e-share">${T.share}</button><button class="btn" id="e-save">${T.save}</button></div>`;
  drawSteps();

  const collect = () => normalizeRecipe({
    ...draft,
    name: $("#e-name").value, author: $("#e-author").value, description: $("#e-desc").value,
    coffee_g: $("#e-coffee").value, water_g: $("#e-water").value, temp_c: $("#e-temp").value, grind: $("#e-grind").value,
    finish_s: $("#e-finish").value, steps: draft.steps,
  });
  const check = () => { const r = collect(); const errs = validateRecipe(r); $("#e-err").textContent = errs.join("　"); return errs.length ? null : r; };
  $("#e-add").addEventListener("click", () => {
    const last = draft.steps[draft.steps.length - 1];
    draft.steps.push({ at_s: (last?.at_s ?? -45) + 45, target_g: (last?.target_g ?? 0) + 60, label: `${draft.steps.length}回目`, note: "" });
    drawSteps();
  });
  $("#e-save").addEventListener("click", () => { const r = check(); if (!r) return; storage.saveRecipe(r); toast(T.saved); navigate("detail", { id: r.id }, { replace: true }); });
  $("#e-share").addEventListener("click", () => { const r = check(); if (r) openShare(r); });
}

// ---- 設定 -------------------------------------------------------------
function renderSettings() {
  chrome({ titleText: T.settings });
  const s = storage.getSettings();
  view.innerHTML = `
    <div class="card">
      <div class="settings-row"><span>${T.soundOn}</span><input type="checkbox" class="switch" id="s-sound" ${s.sound ? "checked" : ""}></div>
      <div class="settings-row"><span>${T.wakeLock}</span><input type="checkbox" class="switch" id="s-wake" ${s.wakeLock ? "checked" : ""}></div>
    </div>
    <div class="section-title">データ</div>
    <div class="card">
      <div class="btn-row"><button class="btn ghost block" id="s-export">${T.export}</button></div>
      <div class="btn-row"><button class="btn ghost block" id="s-import">${T.import}</button><input type="file" id="s-file" accept="application/json" hidden></div>
      <p class="hint" style="margin-top:10px">レシピと履歴はこの端末の中だけに保存されます。機種変更の前に書き出してください。</p>
    </div>
    <div class="section-title">${T.about}</div>
    <div class="card hint">
      レシピの目標湯量と秒数を大きく表示し、スケールを見ながら手で合わせて淹れるためのタイマーです。<br>
      レシピは「共有」から URL / QR にして渡せます。受け取った人がその URL を開くと、同じレシピがその人のマイレシピに入ります。<br>
      <a href="https://github.com/casa2024takayama/drip-timer" style="color:var(--accent)">GitHub</a>
    </div>`;
  $("#s-sound").addEventListener("change", (e) => { storage.saveSettings({ sound: e.target.checked }); sound.setEnabled(e.target.checked); });
  $("#s-wake").addEventListener("change", (e) => storage.saveSettings({ wakeLock: e.target.checked }));
  $("#s-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(storage.exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `drip-timer-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $("#s-import").addEventListener("click", () => $("#s-file").click());
  $("#s-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { storage.importAll(JSON.parse(await f.text())); toast("読み込みました"); } catch (err) { toast(err.message); }
  });
}

// ---- 共有 / ダイアログ ------------------------------------------------
const dialog = $("#dialog");
function openDialog(html) { dialog.innerHTML = `<div class="inner">${html}</div>`; if (!dialog.open) dialog.showModal(); }
function closeDialog() { if (dialog.open) dialog.close(); }
dialog.addEventListener("click", (e) => { if (e.target === dialog) closeDialog(); });
function confirmDialog(msg) {
  return new Promise((res) => {
    openDialog(`<h3>${esc(msg)}</h3><div class="btn-row"><button class="btn ghost" id="d-no">${T.cancel}</button><button class="btn" id="d-ok">OK</button></div>`);
    $("#d-no").onclick = () => { closeDialog(); res(false); };
    $("#d-ok").onclick = () => { closeDialog(); res(true); };
  });
}
async function openShare(recipe) {
  const enc = await encodeRecipe(recipe);
  const url = shareUrl(BASE_URL, enc);
  let qrHtml = "";
  try { const qr = qrcode(0, "M"); qr.addData(url); qr.make(); qrHtml = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch { qrHtml = `<p class="hint">QR を作れませんでした（レシピが長すぎます）。URL を使ってください。</p>`; }
  openDialog(`<h3>${T.shareTitle}</h3><p class="hint">${T.shareHint}</p><div class="qr">${qrHtml}</div><div class="url-box">${esc(url)}</div>
    <div class="btn-row"><button class="btn secondary" id="d-copy">${T.copy}</button>${navigator.share ? `<button class="btn" id="d-share">${T.shareSheet}</button>` : ""}</div>
    <div class="btn-row"><button class="btn ghost block" id="d-close">閉じる</button></div>`);
  $("#d-copy").onclick = async () => { try { await navigator.clipboard.writeText(url); toast(T.copied); } catch { toast("コピーできませんでした。URL を長押しして選択してください"); } };
  $("#d-share")?.addEventListener("click", () => navigator.share({ title: `${recipe.name} — ${T.appTitle}`, url }).catch(() => {}));
  $("#d-close").onclick = closeDialog;
}
async function handleShareHash() {
  const enc = parseShareHash(location.hash);
  if (!enc) return;
  history.replaceState(history.state, "", location.pathname + location.search);
  try {
    const r = await decodeRecipe(enc);
    openDialog(`<h3>${T.importTitle}</h3>${recipeCard(r)}<div class="btn-row"><button class="btn ghost" id="d-no">${T.cancel}</button><button class="btn" id="d-ok">${T.importOk}</button></div>`);
    $("#d-no").onclick = closeDialog;
    $("#d-ok").onclick = () => { storage.saveRecipe(r); closeDialog(); toast(T.imported); navigate("detail", { id: r.id }); };
  } catch (err) { toast(err.message); }
}

// ---- 起動 -------------------------------------------------------------
async function boot() {
  sound.setEnabled(storage.getSettings().sound);
  try {
    const res = await fetch("recipes/builtin.json");
    state.builtin = (await res.json()).recipes.map(normalizeRecipe);
  } catch { state.builtin = []; toast("公式レシピを読み込めませんでした"); }
  history.replaceState({ route: "home", params: {} }, "");
  render();
  handleShareHash();
}
// アプリを開いたまま共有 URL を踏んだ場合（PWA で起きる）
addEventListener("hashchange", handleShareHash);
boot();
