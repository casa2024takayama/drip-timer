// 重量入力の抽象化。今は手動（スケールの表示を人が読む）のみ。
// 将来: WebSocket 経由の Mac ブリッジ（Python/bleak）や Web Bluetooth を同じ形で追加する。
//
// interface WeightSource {
//   readonly kind: string;
//   start(): Promise<void>;   接続開始
//   stop(): void;
//   onWeight(cb: (grams: number, ts: number) => void): () => void;
//   onStatus(cb: (status: "idle"|"connecting"|"connected"|"error", detail?: string) => void): () => void;
// }

export class ManualSource {
  kind = "manual";
  async start() {}
  stop() {}
  onWeight() { return () => {}; }
  onStatus(cb) { cb("idle"); return () => {}; }
}

export function createWeightSource(kind = "manual") {
  switch (kind) {
    default:
      return new ManualSource();
  }
}
