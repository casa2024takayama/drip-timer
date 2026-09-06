# ドリップタイマー

ハンドドリップのレシピを「何秒の時点で累計何 g まで注ぐか」で案内するタイマーです。
Bluetooth 連動なし。キッチンスケールの表示を見ながら、画面の大きな数字に合わせて注ぎます。

公開 URL: https://casa2024takayama.github.io/drip-timer/

iPhone の Safari で開き、共有ボタン →「ホーム画面に追加」でアプリのように使えます（オフラインでも動きます）。

## できること

- **公式レシピ**: 4:6 メソッド（粕谷哲）、ハリオ V60 標準に加えて、チェリーのような果実感を狙う「フルーティー」タグの 6 本（4:6 酸味強調版、James Hoffmann 1 杯用、Matt Winton 5 Pour、Lance Hedrick 1-2-1、ONIBUS COFFEE 浅煎り、GLITCH COFFEE 低温）
- **ドット絵のバリスタ**: 抽出中はケトルから注ぎ、サーバーに液面が溜まります。落ち切り目安を過ぎるとサーバーからカップに注ぎ、カップの香りを嗅ぎます
- **粉量スライダー**: 粉量を変えると湯量と各ステップの累計 g が比例して変わります（秒はそのまま）
- **ブルー画面**: 経過時間、いまの目標累計 g、次の注湯までの残り秒を大きく表示。3・2・1 のカウント音と注湯開始の合図音
- **抽出メモ・履歴**: 豆、挽き目、湯温、5 段階評価、感想を記録。「もう一度淹れる」で前回の粉量を復元
- **レシピエディタ**: 自分のレシピを作成・編集
- **共有**: レシピを URL / QR コードにして渡せます。受け取った人が URL を開くと、その人のマイレシピに入ります
- **バックアップ**: 設定画面から JSON で書き出し・読み込み

データはすべて端末内（localStorage）に保存されます。サーバーには何も送りません。

## レシピの共有と追加のお願い

レシピ詳細 →「共有」で URL と QR が出ます。URL をそのまま送るか、QR を見せてください。

「公式レシピ」に載せたいレシピがあれば、共有 URL を [Issue](https://github.com/casa2024takayama/drip-timer/issues) に貼ってください。`recipes/builtin.json` に追加します。

## レシピの形式

```json
{
  "name": "4:6メソッド",
  "author": "粕谷 哲",
  "description": "説明・コツ",
  "coffee_g": 20,
  "water_g": 300,
  "temp_c": 92,
  "grind": "粗挽き",
  "steps": [
    { "at_s": 0,  "target_g": 60,  "label": "1回目（蒸らし）", "note": "" },
    { "at_s": 45, "target_g": 120, "label": "2回目", "note": "" }
  ],
  "finish_s": 210
}
```

- `at_s`: そのステップを始める秒（昇順）
- `target_g`: そのステップを終えた時点のスケールの数字（累計、単調増加。最後は `water_g` と一致）
- `finish_s`: 落ち切りの目安秒（任意）

## 開発

ビルド不要の静的サイトです。

```bash
python3 -m http.server 8765
```

ロジックのテスト:

```bash
node --test test/recipe.test.mjs
```

デプロイ時は `sw.js` の `VERSION` を上げてください（オフラインキャッシュの更新に使います）。

### 構成

- `js/recipe.js` レシピの検証・スケーリング・URL エンコード（deflate-raw + base64url）
- `js/timer.js` タイマーと現在位置の計算
- `js/audio.js` 合図音（Web Audio）
- `js/storage.js` localStorage
- `js/weight-source.js` 重量入力の抽象化。将来スケール連動（Web Bluetooth / Mac ブリッジ）を足すための口
- `js/vendor/qrcode.js` [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)（MIT）

## iOS での制約

- バイブレーションは iOS Safari 非対応のため、音と画面の点滅で合図します
- バックグラウンドでは音が鳴りません。抽出中は画面を点けたままにしてください（画面消灯抑止は対応端末で自動）

## 出典

- 4:6 メソッド / 酸味強調版: 粕谷哲氏（PHILOCOFFEA）が公開している手順の要約。酸味強調版の配分は https://en.philocoffea.com/blogs/blog/coffee-brewing-method
- ハリオ V60: HARIO が案内する標準的な淹れ方の要約
- James Hoffmann 1 杯用 V60: https://aeroprecipe.com/recipes/james-hoffmann-better-1-cup-v60-technique
- Matt Winton 5 Pour: HARIO 公式動画の要約 https://www.youtube.com/watch?v=YIC-2nFQ7vM （3〜5 回目の秒数は目安）
- Lance Hedrick 1-2-1: https://www.coffeecalculator.app/blog/lance-hedrick-pour-over-recipe
- ONIBUS COFFEE 浅煎りホット: https://onibuscoffee.com/en/pages/brewing_guide/driphot
- GLITCH COFFEE 低温 V60: https://tokyocafegallery.com/glitch-%E3%83%AC%E3%82%B7%E3%83%94/ （挽き目・落ち切り秒数は目安）

数値は各出典の公開値を要約したものです。ご本人・各社とは無関係で、レシピの権利は考案者に帰属します。

## ライセンス

MIT
