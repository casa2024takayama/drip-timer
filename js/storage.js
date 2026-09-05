// localStorage ラッパ。キーは 1 箇所にまとめる。
const KEYS = {
  recipes: "drip.recipes.v1",   // マイレシピ・取り込んだレシピ
  logs: "drip.logs.v1",         // 抽出履歴
  settings: "drip.settings.v1", // 音量など
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  getRecipes: () => read(KEYS.recipes, []),
  saveRecipe(recipe) {
    const list = storage.getRecipes();
    const i = list.findIndex((r) => r.id === recipe.id);
    if (i >= 0) list[i] = recipe; else list.unshift(recipe);
    write(KEYS.recipes, list);
    return recipe;
  },
  deleteRecipe(id) {
    write(KEYS.recipes, storage.getRecipes().filter((r) => r.id !== id));
  },

  getLogs: () => read(KEYS.logs, []),
  saveLog(log) {
    const list = storage.getLogs();
    const i = list.findIndex((l) => l.id === log.id);
    if (i >= 0) list[i] = log; else list.unshift(log);
    write(KEYS.logs, list.slice(0, 500));
    return log;
  },
  deleteLog(id) {
    write(KEYS.logs, storage.getLogs().filter((l) => l.id !== id));
  },

  getSettings: () => ({ sound: true, wakeLock: true, ...read(KEYS.settings, {}) }),
  saveSettings(patch) {
    const s = { ...storage.getSettings(), ...patch };
    write(KEYS.settings, s);
    return s;
  },

  /** 機種変更用のまとめ出力 / 取り込み */
  exportAll() {
    return { version: 1, exported_at: new Date().toISOString(), recipes: storage.getRecipes(), logs: storage.getLogs(), settings: storage.getSettings() };
  },
  importAll(data) {
    if (!data || data.version !== 1) throw new Error("バックアップの形式が違います");
    const recipes = storage.getRecipes();
    for (const r of data.recipes || []) if (!recipes.some((x) => x.id === r.id)) recipes.push(r);
    write(KEYS.recipes, recipes);
    const logs = storage.getLogs();
    for (const l of data.logs || []) if (!logs.some((x) => x.id === l.id)) logs.push(l);
    logs.sort((a, b) => (b.brewed_at || "").localeCompare(a.brewed_at || ""));
    write(KEYS.logs, logs);
    if (data.settings) storage.saveSettings(data.settings);
  },
};
