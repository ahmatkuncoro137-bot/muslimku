const CACHE = 'muslimku-v4';
const PRECACHE = [
  "./",
  "./assets/art/mosque.svg",
  "./assets/azan/azan-aaqib-azeez.mp3",
  "./assets/azan/azan-adam-synagda.mp3",
  "./assets/azan/azan-andrewler.mp3",
  "./assets/azan/azan-mahfoudou.mp3",
  "./assets/azan/azan-sabah-fakhry.mp3",
  "./assets/examples/nissin-front.jpg",
  "./assets/examples/yakult-front.jpg",
  "./assets/fonts/NotoNaskhArabic.ttf",
  "./assets/fonts/PlusJakartaSans.ttf",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./css/app.css",
  "./data/azan.json",
  "./data/cities.json",
  "./data/doa-harian.json",
  "./data/doa-quran.json",
  "./data/halal-example.json",
  "./data/ingredients.json",
  "./data/reciters.json",
  "./data/surahs.json",
  "./index.html",
  "./js/alarm.js",
  "./js/app.js",
  "./js/doa.js",
  "./js/halal.js",
  "./js/murotal.js",
  "./js/prayer.js",
  "./js/qibla.js",
  "./js/util.js",
  "./js/vendor/adhan.LICENSE",
  "./js/vendor/adhan.esm.js",
  "./js/vendor/adhan.umd.min.js",
  "./js/vendor/html5-qrcode.LICENSE",
  "./js/vendor/html5-qrcode.min.js",
  "./manifest.json",
  "./package.json"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of PRECACHE) {
      try { await cache.add(url); } catch (err) { /* skip missing */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // murotal/API stay online-only
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
