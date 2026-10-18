// Bump VERSION whenever you change any file, so iPhones pick up the update.
const VERSION = 'v1';
const SHELL_CACHE = 'salha-scan-shell-' + VERSION;
const OCR_CACHE = 'salha-scan-ocr-v1'; // large OCR files; only change if you replace them

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/app.css',
  'vendor/fonts/cairo-arabic-wght-normal.woff2',
  'vendor/fonts/cairo-latin-wght-normal.woff2',
  'vendor/fonts/cairo-latin-ext-wght-normal.woff2',
  'vendor/fa/css/all.min.css',
  'vendor/fa/webfonts/fa-solid-900.woff2',
  'vendor/fa/webfonts/fa-regular-400.woff2',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'vendor/jspdf.umd.min.js',
  'vendor/tesseract/tesseract.min.js',
  'vendor/tesseract/worker.min.js'
];

const OCR_FILES = [
  'vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  'vendor/tesseract/lang/ara.traineddata.gz',
  'vendor/tesseract/lang/eng.traineddata.gz'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('salha-scan-') && k !== SHELL_CACHE && k !== OCR_CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
    // Download the OCR engine in the background so text extraction works offline later
    const ocr = await caches.open(OCR_CACHE);
    for (const f of OCR_FILES) {
      try { if (!(await ocr.match(f))) await ocr.add(f); } catch (e) { /* retry next launch */ }
    }
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: try network first (to get updates), fall back to cache when offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(SHELL_CACHE);
        c.put('index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Everything else: cache first, then network (and store it)
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) {
      const isOcr = url.pathname.includes('/vendor/tesseract/core/') || url.pathname.includes('/vendor/tesseract/lang/');
      const c = await caches.open(isOcr ? OCR_CACHE : SHELL_CACHE);
      c.put(req, res.clone());
    }
    return res;
  })());
});
