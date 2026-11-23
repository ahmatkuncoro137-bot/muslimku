import { $, escapeHtml, loadJSON, getSettings, toast, haversineKm } from './util.js';

let dict = null;
let examples = { products: [] };
let scanning = false;
let html5 = null;
const HIST_KEY = 'muslimku-halal-history-v1';

export async function initHalal() {
  dict = await loadJSON('data/ingredients.json');
  try { examples = await loadJSON('data/halal-example.json'); } catch { examples = { products: [] }; }
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
}

function pushHistory(item) {
  if (!item || !item.name) return;
  const list = loadHistory().filter((x) => x.code !== item.code || !item.code);
  list.unshift({ ...item, at: item.at || new Date().toISOString() });
  localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 40)));
}

function productImageOf(product, fallback) {
  if (fallback) return fallback;
  if (!product) return '';
  return product.image_front_url || product.image_url || product.image_front_small_url || product.image || '';
}


export function renderHalal(prefillExample = false, exampleCode = '') {
  const view = document.getElementById('view-halal');
  view.innerHTML = `
    <div class="topbar"><h1>Halal Pro</h1></div>
    <p class="disclaimer"><strong>Bukan fatwa.</strong> Hasil hanya panduan dari bahan, label, dan basis data publik. Keputusan halal/haram yang mengikat ada pada ulama dan lembaga sertifikasi. Jangan dianggap pasti.</p>
    <div id="halal-result"></div>
    <div class="btn-row">
      <button type="button" class="btn" id="start-scan">Pindai kode batang</button>
      <button type="button" class="btn secondary" id="photo-barcode">Foto kode batang</button>
      <button type="button" class="btn ghost" id="stop-scan">Stop kamera</button>
      <input type="file" id="barcode-file" accept="image/*" capture="environment" hidden>
    </div>
    <div id="reader" hidden></div>
    <div class="toolbar">
      <input class="search" id="barcode-input" inputmode="numeric" autocomplete="off" placeholder="Atau ketik kode batang (EAN/UPC)">
      <button type="button" class="btn" id="lookup-btn">Cari produk</button>
    </div>
    <div class="toolbar">
      <label class="muted">Periksa teks komposisi / 原材料名</label>
      <textarea id="ing-text" rows="4" placeholder="Tempel atau ketik daftar bahan (Jepang atau Inggris)..."></textarea>
      <div class="btn-row" style="padding:8px 0 0">
        <button type="button" class="btn secondary" id="check-text">Periksa teks</button>
        <button type="button" class="btn ghost" id="ocr-btn">Baca foto label (OCR)</button>
        <input type="file" id="ocr-file" accept="image/*" capture="environment" hidden>
      </div>
    </div>
    <div class="btn-row">
      <button type="button" class="btn ghost" id="show-example">Lihat contoh hasil</button>
    </div>
    <h2 class="section" style="margin-top:8px">Cari restoran / toko halal</h2>
    <p class="muted" style="padding:0 16px">Data dari OpenStreetMap (tag diet:halal). Bisa tidak lengkap di Jepang. Bukan sertifikasi resmi.</p>
    <div class="btn-row"><button type="button" class="btn secondary" id="find-places">Cari di sekitar lokasi</button></div>
    <div id="places"></div>
    <h2 class="section" id="history-title">Riwayat pindai</h2>
    <div id="halal-history"></div>
  `;
  $('#start-scan', view).addEventListener('click', startScan);
  $('#stop-scan', view).addEventListener('click', stopScan);
  $('#photo-barcode', view).addEventListener('click', () => $('#barcode-file', view).click());
  $('#barcode-file', view).addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) decodeBarcodePhoto(f);
  });
  $('#lookup-btn', view).addEventListener('click', () => lookupBarcode($('#barcode-input', view).value));
  $('#check-text', view).addEventListener('click', () => {
    const text = $('#ing-text', view).value;
    showVerdict({ source: 'Teks bahan yang Anda masukkan', name: 'Pemeriksaan teks label', text, example: false });
  });
  $('#ocr-btn', view).addEventListener('click', () => $('#ocr-file', view).click());
  $('#ocr-file', view).addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) runOcr(f);
  });
  $('#show-example', view).addEventListener('click', showExample);
  $('#find-places', view).addEventListener('click', findPlaces);
  renderHistory();
  if (prefillExample) showExample(exampleCode);
}

function showExample(code = '') {
  const list = examples.products || [];
  const main = (code && list.find((p) => p.code === code)) || list[0];
  if (!main) return;
  if ($('#ing-text')) $('#ing-text').value = main.ingredients_text || '';
  if ($('#barcode-input')) $('#barcode-input').value = main.code || '';
  // Seed history with real OFF examples (marked CONTOH), newest first.
  for (const prod of [...list].reverse()) {
    const hits = analyzeIngredients(prod.ingredients_text || '');
    const hasCert = certFound(prod.labels || '', prod.ingredients_text || '');
    const decision = decide(hits, hasCert, prod.ingredients_text || '');
    pushHistory({
      code: prod.code,
      name: prod.name,
      brands: prod.brands,
      image: prod.image,
      verdict: decision.word,
      kind: decision.kind,
      example: true,
      source: prod.source
    });
  }
  showVerdict({
    source: 'CONTOH — produk nyata Open Food Facts, bukan pindai hidup',
    name: main.name,
    text: main.ingredients_text || '',
    labels: main.labels || '',
    brands: main.brands || '',
    example: true,
    image: main.image,
    code: main.code,
    product: main
  });
  renderHistory();
}

function normalizeBarcode(raw) {
  return String(raw || '').replace(/\D/g, '');
}

let zxingModPromise = null;
async function loadZxing() {
  if (!zxingModPromise) {
    zxingModPromise = import('./vendor/zxing-wasm/es/reader/index.js').then((mod) => {
      const wasmUrl = new URL('./vendor/zxing-wasm/reader/zxing_reader.wasm', import.meta.url).href;
      mod.prepareZXingModule({
        overrides: {
          locateFile: (path) => (String(path).endsWith('.wasm') ? wasmUrl : path)
        }
      });
      return mod;
    });
  }
  return zxingModPromise;
}

async function decodeWithZxing(input) {
  const mod = await loadZxing();
  const results = await mod.readBarcodes(input, { tryHarder: true, tryRotate: true, tryInvert: true });
  const hit = (results || []).find((r) => r && r.text && !r.error);
  return hit ? normalizeBarcode(hit.text) : '';
}

async function decodeBarcodePhoto(file) {
  toast('Membaca kode batang dari foto…');
  try {
    let code = '';
    try { code = await decodeWithZxing(file); } catch { /* try other decoders */ }
    if (!code && 'BarcodeDetector' in window) {
      try {
        const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const bmp = await createImageBitmap(file);
        const codes = await det.detect(bmp);
        if (codes && codes[0] && codes[0].rawValue) code = normalizeBarcode(codes[0].rawValue);
      } catch { /* next */ }
    }
    if (!code && typeof Html5Qrcode !== 'undefined') {
      const holder = document.createElement('div');
      holder.id = 'h5-file-tmp';
      holder.style.display = 'none';
      document.body.appendChild(holder);
      try {
        const qr = new Html5Qrcode('h5-file-tmp');
        const text = await qr.scanFile(file, false);
        code = normalizeBarcode(text);
      } catch { /* ignore */ }
      holder.remove();
    }
    if (code) {
      const input = document.getElementById('barcode-input');
      if (input) input.value = code;
      lookupBarcode(code);
    } else {
      toast('Kode batang tidak terbaca. Coba foto lebih dekat dan terang, atau ketik angkanya.');
    }
  } catch {
    toast('Gagal membaca foto. Ketik kode batang, atau periksa dari teks bahan.');
  }
}

async function decodeVideoFrame(video) {
  if (!video || !video.videoWidth) return '';
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0);
  try {
    return await decodeWithZxing(ctx.getImageData(0, 0, c.width, c.height));
  } catch {
    return '';
  }
}

function onBarcodeFound(raw) {
  const code = normalizeBarcode(raw);
  if (!code) return false;
  const input = document.getElementById('barcode-input');
  if (input) input.value = code;
  stopScan();
  lookupBarcode(code);
  return true;
}

async function startScan() {
  const box = document.getElementById('reader');
  box.hidden = false;
  box.innerHTML = '';
  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.autoplay = true;
      video.srcObject = stream;
      video.style.width = '100%';
      box.replaceChildren(video);
      scanning = true;
      let lastZxing = 0;
      const loop = async () => {
        if (!scanning) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes && codes[0] && codes[0].rawValue && onBarcodeFound(codes[0].rawValue)) return;
        } catch { /* frame without barcode */ }
        const now = Date.now();
        if (now - lastZxing > 450) {
          lastZxing = now;
          try {
            const code = await decodeVideoFrame(video);
            if (code && onBarcodeFound(code)) return;
          } catch { /* keep scanning */ }
        }
        requestAnimationFrame(loop);
      };
      video.addEventListener('loadeddata', () => requestAnimationFrame(loop));
      return;
    } catch (err) {
      /* fall through to html5-qrcode */
    }
  }
  if (typeof Html5Qrcode === 'undefined') {
    toast('Pemindai tidak tersedia di browser ini. Ketik kode batang saja.');
    return;
  }
  try {
    html5 = new Html5Qrcode('reader');
    scanning = true;
    await html5.start({ facingMode: 'environment' }, { fps: 8, qrbox: 220 }, (text) => {
      onBarcodeFound(text);
    });
    // Stronger 1-D decoder on captured frames (helps dim / angled EAN-13).
    const video = document.querySelector('#reader video');
    if (video) {
      const tick = async () => {
        if (!scanning) return;
        try {
          const code = await decodeVideoFrame(video);
          if (code && onBarcodeFound(code)) return;
        } catch { /* keep scanning */ }
        setTimeout(tick, 500);
      };
      setTimeout(tick, 600);
    }
  } catch {
    toast('Kamera tidak dapat dibuka. Izinkan kamera, atau ketik kodenya.');
  }
}

async function stopScan() {
  scanning = false;
  if (html5) {
    try { await html5.stop(); } catch { /* already stopped */ }
    try { await html5.clear(); } catch { /* ignore */ }
    html5 = null;
  }
  const box = document.getElementById('reader');
  if (box) {
    const video = box.querySelector('video');
    if (video && video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
    box.hidden = true;
    box.innerHTML = '';
  }
}

function bindNotFoundActions(root) {
  const ocr = root.querySelector('#nf-ocr');
  const typ = root.querySelector('#nf-type');
  if (ocr) ocr.addEventListener('click', () => {
    const btn = document.getElementById('ocr-btn');
    if (btn) btn.click();
    const ta = document.getElementById('ing-text');
    if (ta) ta.scrollIntoView({ block: 'center' });
  });
  if (typ) typ.addEventListener('click', () => {
    const ta = document.getElementById('ing-text');
    if (!ta) return;
    ta.scrollIntoView({ block: 'center' });
    ta.classList.add('ing-text-focus');
    ta.focus();
    setTimeout(() => ta.classList.remove('ing-text-focus'), 2500);
  });
}

function showNotFound(code, extra = '') {
  const out = document.getElementById('halal-result');
  out.innerHTML = `
    <div class="verdict unknown" data-testid="not-found">
      <div class="label">Tidak ditemukan</div>
      <div class="word">Produk belum ada di database</div>
      <p>Kode ${escapeHtml(code)} tidak tercatat di Open Food Facts. Kamu tetap bisa memeriksa dari kemasan.${extra ? ' ' + extra : ''}</p>
      <div class="notfound-actions btn-row">
        <button type="button" class="btn" id="nf-ocr">Foto komposisi (OCR)</button>
        <button type="button" class="btn secondary" id="nf-type">Ketik komposisi</button>
      </div>
    </div>`;
  bindNotFoundActions(out);
}

async function lookupBarcode(raw) {
  const code = normalizeBarcode(raw);
  if (!code) { toast('Masukkan kode batang.'); return; }
  const out = document.getElementById('halal-result');
  out.innerHTML = '<p class="empty">Mencari di Open Food Facts…</p>';
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!data || data.status !== 1 || !data.product) {
      showNotFound(code);
      return;
    }
    const p = data.product;
    const name = p.product_name_ja || p.product_name || p.product_name_en || 'Produk tanpa nama';
    const text = [p.ingredients_text_ja, p.ingredients_text, p.ingredients_text_en, p.allergens, (p.labels || '')].filter(Boolean).join('\n');
    const labels = [...(p.labels_tags || []), p.labels || ''].join(' ').toLowerCase();
    const image = productImageOf(p);
    showVerdict({ source: `Open Food Facts · kode ${code}`, name, text, labels, brands: p.brands, example: false, product: p, image, code });
  } catch {
    out.innerHTML = `<p class="empty">Gagal menghubungi Open Food Facts. Periksa koneksi, atau periksa dari kemasan.</p>
      <div class="notfound-actions btn-row">
        <button type="button" class="btn" id="nf-ocr">Foto komposisi (OCR)</button>
        <button type="button" class="btn secondary" id="nf-type">Ketik komposisi</button>
      </div>`;
    bindNotFoundActions(out);
  }
}

function normalize(s) {
  return String(s || '');
}

export function analyzeIngredients(text) {
  const original = normalize(text);
  const hits = [];
  const ignore = dict.ignore_substrings || [];
  // Build a masked copy so 酒 inside 醤油 is not counted.
  let masked = original;
  for (const ign of ignore) masked = masked.split(ign).join(' '.repeat(ign.length));
  const maskedLower = masked.toLowerCase();

  for (const group of dict.terms) {
    for (const term of group.terms) {
      const isAscii = /^[\x00-\x7F]+$/.test(term);
      let found = false;
      if (isAscii) {
        const re = new RegExp(`(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i');
        found = re.test(maskedLower);
      } else {
        found = masked.includes(term);
      }
      if (found) {
        hits.push({ term, verdict: group.verdict, label: group.label_id, group: group.id });
        break;
      }
    }
  }
  return hits;
}

function certFound(labels, text) {
  const blob = `${labels || ''} ${text || ''}`.toLowerCase();
  const tagHit = (dict.halal_cert_tags || []).some((t) => blob.includes(t.toLowerCase()));
  const termHit = (dict.halal_cert_terms || []).some((t) => blob.includes(t.toLowerCase()));
  return tagHit || termHit;
}

function decide(hits, hasCert, text) {
  const empty = !String(text || '').trim();
  const haram = hits.filter((h) => h.verdict === 'haram');
  const syubhat = hits.filter((h) => h.verdict === 'syubhat');
  if (empty && !hasCert) return { kind: 'unknown', word: 'BELUM JELAS', lead: 'Data bahan tidak cukup untuk menilai.' };
  if (haram.length) {
    const onlyAnim = haram.every((h) => h.group === 'animal-oil');
    const hasAnim = haram.some((h) => h.group === 'animal-oil');
    let lead = 'Ditemukan bahan yang merujuk pada babi atau alkohol.';
    if (onlyAnim) lead = 'Mengandung minyak/lemak hewani.';
    else if (hasAnim) lead = 'Ditemukan bahan haram, termasuk minyak/lemak hewani.';
    return { kind: 'haram', word: 'HARAM', lead };
  }
  if (syubhat.length) {
    return { kind: 'syubhat', word: 'SYUBHAT', lead: 'Ada bahan meragukan (sumber tidak jelas). Lebih aman dihindari sampai ada kepastian.' };
  }
  if (hasCert) return { kind: 'halal', word: 'HALAL', lead: 'Ada indikasi sertifikasi halal dan tidak ditemukan bahan haram/syubhat pada teks yang tersedia.' };
  return { kind: 'syubhat', word: 'SYUBHAT', lead: 'Tidak ditemukan bahan haram yang cocok, tetapi tanpa sertifikasi resmi kami tidak menyatakan halal secara pasti.' };
}

function showVerdict({ source, name, text, labels = '', brands = '', example = false, product = null, image = '', code = '' }) {
  const hits = analyzeIngredients(text);
  const hasCert = certFound(labels, text);
  const decision = decide(hits, hasCert, text);

  const hitHtml = hits.length
    ? `<ul class="ing-list">${hits.map((h) => `<li class="${h.verdict}"><strong>${escapeHtml(h.term)}</strong> — ${escapeHtml(h.label)} (${h.verdict})</li>`).join('')}</ul>`
    : '<p class="muted" style="padding:0 16px">Tidak ada istilah curah yang cocok dari daftar kurasi.</p>';

  const img = image || productImageOf(product);
  const imgHtml = img
    ? `<img class="product-photo" id="product-photo" src="${escapeHtml(img)}" alt="Foto ${escapeHtml(name)}" width="240" height="240">`
    : `<div class="product-photo placeholder" id="product-photo">Tidak ada foto produk</div>`;

  document.getElementById('halal-result').innerHTML = `
    <div class="verdict ${decision.kind}" data-testid="verdict">
      <div class="label">Panduan status</div>
      <div class="word">${decision.word}</div>
      <p>${escapeHtml(decision.lead)}</p>
      ${example ? '<div class="example-flag">CONTOH HASIL — BUKAN PINDAI NYATA</div>' : ''}
    </div>
    <div class="card product-card" data-testid="product-card">
      ${imgHtml}
      <div class="product-meta">
        <div class="product-name">${escapeHtml(name)}</div>
        ${brands ? `<div class="product-brand">${escapeHtml(brands)}</div>` : ''}
        ${code ? `<div class="muted">Kode ${escapeHtml(code)}</div>` : ''}
        <div class="muted">${escapeHtml(source)}</div>
        ${hasCert ? '<p><strong>Indikasi label halal terdeteksi.</strong> Tetap cek logo dan lembaga sertifikasi di kemasan.</p>' : ''}
      </div>
    </div>
    <h3 class="section" style="margin-top:4px">Bahan yang disorot</h3>
    ${hitHtml}
    <details class="note"><summary>Teks yang diperiksa</summary><pre style="white-space:pre-wrap">${escapeHtml(text || '(kosong)')}</pre></details>
    <p class="disclaimer">Hasil ini bukan fatwa dan bukan jaminan. Produsen bisa mengubah resep. Di Jepang, meragukan (syubhat) sering muncul karena 乳化剤, ゼラチン, dan みりん. Jika ragu, jangan dimakan sampai jelas.</p>
  `;
  if (name && name !== 'Pemeriksaan teks label') {
    pushHistory({
      code: code || '',
      name,
      brands,
      image: img,
      verdict: decision.word,
      kind: decision.kind,
      example: !!example,
      source
    });
    renderHistory();
  }
}

function renderHistory() {
  const box = document.getElementById('halal-history');
  if (!box) return;
  const list = loadHistory();
  if (!list.length) {
    box.innerHTML = '<p class="empty">Belum ada riwayat pindai. Hasil pindaian akan muncul di sini beserta fotonya.</p>';
    return;
  }
  box.innerHTML = list.map((it) => `
    <button type="button" class="history-item" data-code="${escapeHtml(it.code || '')}">
      ${it.image ? `<img src="${escapeHtml(it.image)}" alt="" class="history-thumb">` : `<div class="history-thumb placeholder"></div>`}
      <div>
        <div style="font-weight:800">${escapeHtml(it.name)}</div>
        <div class="muted">${escapeHtml(it.brands || '')}${it.example ? ' · CONTOH' : ''}</div>
      </div>
      <span class="hist-verdict ${it.kind || ''}">${escapeHtml(it.verdict || '')}</span>
    </button>
  `).join('');
}


async function runOcr(file) {
  toast('Menyiapkan modul OCR (pertama kali bisa lama)...');
  try {
    const { default: Tesseract } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js');
    const imgUrl = URL.createObjectURL(file);
    const result = await Tesseract.recognize(imgUrl, 'jpn+eng', {
      logger: () => {}
    });
    URL.revokeObjectURL(imgUrl);
    const text = (result && result.data && result.data.text) || '';
    document.getElementById('ing-text').value = text;
    showVerdict({ source: 'OCR label (tesseract.js, jpn+eng) — bisa salah baca', name: 'Hasil baca foto label', text, example: false });
  } catch {
    toast('OCR gagal dimuat. Ketik atau tempel teks bahan saja.');
  }
}

async function findPlaces() {
  const box = document.getElementById('places');
  const s = getSettings();
  const { lat, lon, label } = s.coords;
  box.innerHTML = `<p class="empty">Mencari di sekitar ${escapeHtml(label)}…</p>`;
  const q = `[out:json][timeout:25];
    (
      nwr["diet:halal"~"yes|only"](around:8000,${lat},${lon});
      nwr["cuisine"~"halal",i](around:8000,${lat},${lon});
    );
    out center 40;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: 'data=' + encodeURIComponent(q)
    });
    if (!res.ok) throw new Error('overpass ' + res.status);
    const data = await res.json();
    const els = data.elements || [];
    if (!els.length) {
      box.innerHTML = '<p class="empty">Tidak ada tempat bertag halal dalam 8 km di OpenStreetMap. Coba kota lain atau cek langsung ke masjid setempat.</p>';
      return;
    }
    const seen = new Set();
    const items = [];
    for (const el of els) {
      const plat = el.lat || (el.center && el.center.lat);
      const plon = el.lon || (el.center && el.center.lon);
      const name = (el.tags && (el.tags.name || el.tags['name:en'] || el.tags['name:ja'])) || 'Tanpa nama';
      const key = `${name}|${plat}|${plon}`;
      if (seen.has(key) || plat == null) continue;
      seen.add(key);
      const km = haversineKm(lat, lon, plat, plon);
      const kind = (el.tags && (el.tags.amenity || el.tags.shop || el.tags.cuisine)) || '';
      items.push({ name, km, kind, plat, plon });
    }
    items.sort((a, b) => a.km - b.km);
    box.innerHTML = items.slice(0, 30).map((p) => `
      <div class="place-item">
        <div style="font-weight:800">${escapeHtml(p.name)}</div>
        <div class="muted">${p.km < 1 ? Math.round(p.km * 1000) + ' m' : p.km.toFixed(1) + ' km'} · ${escapeHtml(p.kind)}</div>
        <a href="https://www.openstreetmap.org/?mlat=${p.plat}&mlon=${p.plon}#map=18/${p.plat}/${p.plon}" target="_blank" rel="noopener">Buka peta</a>
      </div>
    `).join('');
  } catch {
    box.innerHTML = '<p class="empty">Gagal menghubungi server OpenStreetMap Overpass. Coba lagi nanti.</p>';
  }
}

export { stopScan };
