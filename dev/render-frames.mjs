// デモの描画ロジックを Node で実行し、各場面を PNG に書き出す（ブラウザなしで確認するため）
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
const html = readFileSync(new URL("./barista.html", import.meta.url), "utf8");
let js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
js = js.slice(0, js.indexOf("// ---- デモ用タイマー"));            // タイマー部分は不要
const stub = `
  const document = { getElementById: () => ({ appendChild() {} }), querySelector: () => ({}) };
  const requestAnimationFrame = () => {}; const matchMedia = () => ({ matches: false });
`;
const api = new Function(stub + js.replace(/const svg = [\s\S]*?const put =/, "const put =") + "\nreturn { PAL, frameBrew, frameDone, COLS, ROWS };")();

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function png(grid, scale = 8, bg = [244, 233, 220]) {
  const w = api.COLS * scale, h = api.ROWS * scale;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const ch = grid[Math.floor(y / scale)][Math.floor(x / scale)];
      const c = api.PAL[ch] ? hex(api.PAL[ch]) : bg;
      raw.set(c, y * (w * 3 + 1) + 1 + x * 3);
    }
  }
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const frames = {
  "1-pour": api.frameBrew(0.5, true, 0.4, false),
  "2-idle": api.frameBrew(0.5, false, 0.4, false),
  "3-done-set": api.frameDone(0.3, 0.3),
  "4-done-pourcup": api.frameDone(2.2, 2.2),
  "5-done-reach": api.frameDone(3.9, 3.9),
  "6-done-smell": api.frameDone(5.1, 5.1),
};
// 6 枚を 2 列 3 行に並べた 1 枚も作る
const names = Object.keys(frames);
const sheet = [];
for (let r = 0; r < 3; r++) for (let y = 0; y < api.ROWS; y++) sheet.push(frames[names[r * 2]][y] + "..." + frames[names[r * 2 + 1]][y]);
for (let r = 1; r < 3; r++) sheet.splice(r * (api.ROWS + 1) - 1, 0, ".".repeat(api.COLS * 2 + 3));
const saveCols = api.COLS, saveRows = api.ROWS;
api.COLS = api.COLS * 2 + 3; api.ROWS = sheet.length;
writeFileSync("frames.png", png(sheet, 7));
api.COLS = saveCols; api.ROWS = saveRows;
console.log("wrote frames.png", names.join(", "));
