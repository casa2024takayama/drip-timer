// ドット絵バリスタ。ブルー画面のカード上部に描く。
// 道具（ケトル・ドリッパー・サーバー・カップ）はスプライトを 1 つずつ定義し、
// 決まった位置に「置く / 持つ」だけで場面を組む。形と置き場所は全場面で共通。
//
// createBarista(svg) → { brew(t, pouring, fill, blink), done(t, tDone) }
//   t: アニメ用の経過秒（performance.now()/1000 など）。0 固定なら静止画
//   pouring: ケトルから注いでいる最中か
//   fill: サーバーの液面（0〜1、総湯量に対する割合）
//   tDone: 完了してからの秒数

export function createBarista(svg) {
  const COLS = 44, ROWS = 22;
  const PAL = {
    H: "#3b2a20", S: "#f4c89a", E: "#2a1e17", B: "#f0a08a", W: "#fbf7f1", A: "#b8622b", D: "#8e4a1f",
    K: "#6b7280", k: "#a3a9b3", w: "#7fb3d5", P: "#f3ede4", V: "#d9685c", G: "#b9d7e0", C: "#4a2c17", c: "#7a4a2a",
    T: "#5a3d2e", t: "#7a5443", M: "#d8cfc4", Y: "#f2c14e", y: "#fbe7a8", U: "#4f86b5", u: "#8fb8d9",
  };

  // 道具（形はここだけで決まる）
  const KETTLE  = [".kk...", "KKKKK.", "KkKKKK", ".KKK.K"];                 // 注ぎ口は右下 (5,3)
  const DRIPPER = ["PPPPPPPPP", ".VPPPPPPV", "..VPPPPV.", "...VPPV..", "....VV..."];
  const SERVER  = ["GGGGG", "G...G", "G...G", "GGGGG"];                     // 中身は (1-3, 1-2) の 6 マス
  const CUP     = ["U...U.", "U...UU", "U...U.", "UUUUU."];                 // 中身は (1-3, 0-2) の 9 マス。右に取っ手

  // 置き場所・持ち位置（全場面で共通）
  const AT = {
    kettleRest: [0, 15], kettleFar: [23, 2], kettleChest: [16, 8],
    dripperOn: [24, 11], dripperAside: [34, 14],
    serverSpot: [26, 15], serverHand: [16, 3],
    cupSpot: [18, 15], cupHand: [8, 8],
  };

  // バリスタのポーズ（rows 0-18）
  const POSE_DOWN = [
    "............................................",
    "........HHHHHH..............................",
    ".......HHHHHHHH.............................",
    ".......HHHHHHHH.............................",
    ".......HSSSSSSH.............................",
    ".......HSESSSES.............................",
    ".......HSSSSSSS.............................",
    "........SBSSBS..............................",
    ".........SSSS...............................",
    "........WWWWWWWW............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
  ];
  const POSE_FAR = [
    "............................................",
    "........HHHHHH..............................",
    ".......HHHHHHHH.............................",
    ".......HHHHHHHH......SS.....................",
    ".......HSSSSSSH.....SS......................",
    ".......HSESSSES....W........................",
    ".......HSSSSSSS...WW........................",
    "........SBSSBS...WW.........................",
    ".........SSSS..WW...........................",
    "........WWWWWWWWW...........................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
  ];
  const POSE_CHEST = [
    "............................................",
    "........HHHHHH..............................",
    ".......HHHHHHHH.............................",
    ".......HHHHHHHH.............................",
    ".......HSSSSSSH.............................",
    ".......HSESSSES.............................",
    ".......HSSSSSSS.............................",
    "........SBSSBS..............................",
    ".........SSSS...............................",
    "........WWWWWWWS............................",
    ".......WWAAAAWWS............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
  ];
  const POSE_NEAR = [
    "............................................",
    "........HHHHHH..............................",
    ".......HHHHHHHH.............................",
    ".......HHHHHHHH.............................",
    ".......HSSSSSSHS............................",
    ".......HSESSSESS............................",
    ".......HSSSSSSWW............................",
    "........SBSSBSW.............................",
    ".........SSSSW..............................",
    "........WWWWWWWW............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
  ];
  const POSE_SMELL = [
    "............................................",
    "........HHHHHH..............................",
    ".......HHHHHHHH.............................",
    ".......HHHHHHHH.............................",
    ".......HSSSSSSH.............................",
    ".......HSEESEES.............................",
    ".......HSSSSSSS.............................",
    "........SBSSBS..............................",
    ".......S.SSSS.S.............................",
    ".......SWWWWWWSW............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WWAAAAWW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
    ".......WDDDDDDW.............................",
  ];

  const cells = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", 1); r.setAttribute("height", 1);
    r.setAttribute("fill", "none"); svg.appendChild(r); cells.push(r);
  }
  const put = (g, x, y, ch) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y] = g[y].substring(0, x) + ch + g[y].substring(x + 1); };
  const stamp = (g, sprite, [x, y]) => sprite.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== ".") put(g, x + dx, y + dy, ch); }));
  const fillCells = (g, list, n, ch = "C") => { for (let i = 0; i < Math.min(n, list.length); i++) put(g, list[i][0], list[i][1], ch); };
  const serverCells = ([x, y]) => [[x+1,y+2],[x+2,y+2],[x+3,y+2],[x+1,y+1],[x+2,y+1],[x+3,y+1]];   // 下の行から満ちる
  const cupCells = ([x, y]) => [[x+1,y+2],[x+2,y+2],[x+3,y+2],[x+1,y+1],[x+2,y+1],[x+3,y+1],[x+1,y],[x+2,y],[x+3,y]];

  function base() {
    const g = Array.from({ length: ROWS }, () => ".".repeat(COLS));
    g[19] = "t".repeat(COLS); g[20] = "T".repeat(COLS); g[21] = "T".repeat(COLS);
    return g;
  }
  const pose = (g, p) => p.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") put(g, x, y, ch); }));
  const blinkAt = (g) => { put(g, 9, 5, "S"); put(g, 13, 5, "S"); };

  // 湯気: 起点 (sx, fromY) から上へ、length マス分の範囲でゆらぎながら昇る
  function steam(g, sx, fromY, length, phaseOffset, f) {
    const ph = (f + phaseOffset) % (length + 2);
    if (ph < length) {
      const y = fromY - ph;
      put(g, sx + ((ph % 2) ? 1 : 0), y, "M");
      if (ph >= 1) put(g, sx, y + 1, "M");
    }
  }

  // ---- 抽出中 ----------------------------------------------------------
  function frameBrew(t, pouring, progress, blink) {
    const f = Math.floor(t * 6);
    const g = base();
    stamp(g, CUP, AT.cupSpot);
    stamp(g, SERVER, AT.serverSpot);
    fillCells(g, serverCells(AT.serverSpot), Math.round(progress * 6));
    stamp(g, DRIPPER, AT.dripperOn);
    if (pouring) {
      pose(g, POSE_FAR); stamp(g, KETTLE, AT.kettleFar);
      // お湯: ケトルの注ぎ口 (28,5) の下、col 28 を rows 6-10 に流れる
      for (let y = 6; y <= 10; y++) put(g, 28, y, ((y + f) % 3 === 0) ? "." : "w");
      put(g, 27 + ((f % 2) * 2), 11, "w");          // 着水の跳ね
      put(g, 27, 13, "c"); put(g, 28, 13, "c"); put(g, 29, 13, "c"); put(g, 28, 14, "C"); // 湿った粉
      steam(g, 25, 10, 4, 0, f); steam(g, 31, 10, 4, 3, f);
    } else {
      pose(g, POSE_CHEST); stamp(g, KETTLE, AT.kettleChest);
      if (progress > 0) { put(g, 28, 14, "C"); steam(g, 28, 10, 4, 0, f); }
    }
    if (blink) blinkAt(g);
    return g;
  }

  // ---- 完了 -------------------------------------------------------------
  //   0.0〜0.8 s: ケトルを置き、ドリッパーを脇へ。サーバーは満タン、カップは空（道具を全部見せる）
  //   0.8〜3.6 s: サーバーを持ち上げてカップに注ぐ
  //   3.6〜4.2 s: 空のサーバーを戻す
  //   4.2 s〜   : カップを持ち上げて香りを嗅ぐ（ループ）
  function frameDone(t, tDone) {
    const f = Math.floor(t * 6);
    const g = base();
    stamp(g, KETTLE, AT.kettleRest);
    stamp(g, DRIPPER, AT.dripperAside);
    if (tDone < 0.8) {
      pose(g, POSE_DOWN);
      stamp(g, SERVER, AT.serverSpot); fillCells(g, serverCells(AT.serverSpot), 6);
      stamp(g, CUP, AT.cupSpot);
      steam(g, 28, 14, 3, 0, f);
      return g;
    }
    if (tDone < 3.6) {
      const p = (tDone - 0.8) / 2.8;
      pose(g, POSE_NEAR);
      stamp(g, SERVER, AT.serverHand); fillCells(g, serverCells(AT.serverHand), 6 - Math.floor(p * 6));
      stamp(g, CUP, AT.cupSpot);
      const filled = Math.floor(p * 9);
      fillCells(g, cupCells(AT.cupSpot), filled);
      if (p < 0.95) {
        // サーバーの右の縁 (20,6) からカップの液面まで、col 20 を落ちる
        const surface = 17 - Math.floor(filled / 3);
        put(g, 20, 6, "C");
        for (let y = 7; y < surface; y++) put(g, 20, y, ((y + f) % 4 === 0) ? "c" : "C");
      }
      if (filled >= 3) steam(g, 19 + (f % 2) * 2, 14, 2, 0, f);
      return g;
    }
    if (tDone < 4.2) {
      pose(g, POSE_DOWN);
      stamp(g, SERVER, AT.serverSpot);
      stamp(g, CUP, AT.cupSpot); fillCells(g, cupCells(AT.cupSpot), 9);
      steam(g, 20, 14, 3, 0, f);
      return g;
    }
    const ts = tDone - 4.2;
    stamp(g, SERVER, AT.serverSpot);
    pose(g, POSE_SMELL);
    stamp(g, CUP, AT.cupHand); fillCells(g, cupCells(AT.cupHand), 9);
    // カップの縁から顔の前へ昇る湯気 2 本
    steam(g, 9, 7, 4, 0, Math.floor(ts * 4)); steam(g, 11, 7, 4, 3, Math.floor(ts * 4));
    // 香りの粒
    [[5, 4], [17, 3], [16, 7]].forEach(([sx, sy], i) => {
      const ph = (f + i * 3) % 9;
      if (ph === 0 || ph === 2) put(g, sx, sy, "y"); else if (ph === 1) put(g, sx, sy, "Y");
    });
    // 体の揺れ: バリスタ（cols 0-15）だけ 1 マス右へ、1.6 秒周期
    return (Math.floor(ts / 0.8) % 2) ? g.map((row, y) => (y <= 18 ? "." + row.slice(0, 15) + row.slice(16) : row)) : g;
  }

  function paint(g) {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const fill = PAL[g[y][x]] || "none"; const cell = cells[y * COLS + x];
      if (cell.getAttribute("fill") !== fill) cell.setAttribute("fill", fill);
    }
  }


  return {
    brew: (t, pouring, fill, blink) => paint(frameBrew(t, pouring, fill, blink)),
    done: (t, tDone) => paint(frameDone(t, tDone)),
  };
}
