// 抽出タイマー。performance.now() 基準でドリフトしない。tick は rAF で描画側が呼ぶ。
export class BrewTimer {
  constructor() {
    this.running = false;
    this._startAt = 0;     // performance.now() 基準
    this._elapsedBase = 0; // 一時停止までの累積 ms
  }
  get elapsedMs() {
    return this.running ? this._elapsedBase + (performance.now() - this._startAt) : this._elapsedBase;
  }
  get elapsedS() {
    return this.elapsedMs / 1000;
  }
  start() {
    if (this.running) return;
    this._startAt = performance.now();
    this.running = true;
  }
  pause() {
    if (!this.running) return;
    this._elapsedBase += performance.now() - this._startAt;
    this.running = false;
  }
  reset() {
    this.running = false;
    this._elapsedBase = 0;
  }
}

/**
 * 経過秒からレシピ上の現在位置を求める。
 * 戻り値: { index, step, next, remainToNext, done, targetG }
 *  index: 現在ステップ（開始前は -1）
 *  targetG: いま画面に出す累計目標 g（現在ステップの target_g。開始前は 0）
 */
export function locate(recipe, elapsedS) {
  const steps = recipe.steps;
  let index = -1;
  for (let i = 0; i < steps.length; i++) if (elapsedS >= steps[i].at_s) index = i;
  const step = index >= 0 ? steps[index] : null;
  const next = index + 1 < steps.length ? steps[index + 1] : null;
  const finish = recipe.finish_s ?? null;
  const done = next == null && finish != null && elapsedS >= finish;
  let remainToNext = null;
  if (next) remainToNext = next.at_s - elapsedS;
  else if (finish != null) remainToNext = finish - elapsedS;
  return { index, step, next, remainToNext, done, targetG: step ? step.target_g : 0 };
}
