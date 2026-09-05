// Web Audio による合図音。iOS はユーザー操作の中で unlock() を呼ぶ必要がある。
let ctx = null;
let enabled = true;

export const sound = {
  setEnabled(v) { enabled = !!v; },
  get enabled() { return enabled; },
  unlock() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      // 無音を 1 発鳴らして iOS の再生許可を得る
      const o = ctx.createOscillator(); const g = ctx.createGain();
      g.gain.value = 0; o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.01);
    } catch { /* 音なしで続行 */ }
  },
  beep({ freq = 880, dur = 0.12, gain = 0.25, type = "sine" } = {}) {
    if (!enabled || !ctx) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  },
  tick() { sound.beep({ freq: 660, dur: 0.08, gain: 0.15 }); },            // 3,2,1 のカウント
  pour() { sound.beep({ freq: 988, dur: 0.35, gain: 0.3 }); },             // 注湯開始
  finish() {                                                                // 終了
    sound.beep({ freq: 784, dur: 0.15 });
    setTimeout(() => sound.beep({ freq: 988, dur: 0.15 }), 160);
    setTimeout(() => sound.beep({ freq: 1318, dur: 0.4 }), 320);
  },
};
