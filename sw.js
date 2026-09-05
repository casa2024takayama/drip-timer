// オフライン用キャッシュ。デプロイのたびに VERSION を上げる。
const VERSION = "v1.0.0";
const CACHE = `drip-timer-${VERSION}`;
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js", "./js/recipe.js", "./js/timer.js", "./js/audio.js", "./js/storage.js", "./js/weight-source.js", "./js/vendor/qrcode.js",
  "./recipes/builtin.json",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-512-maskable.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
// ネットワーク優先、失敗時はキャッシュ（更新をすぐ反映しつつオフラインでも動く）
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});
