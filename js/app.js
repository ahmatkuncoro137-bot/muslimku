import { $, escapeHtml, getSettings, saveSettings, loadJSON, formatClock, formatGregorian, formatHijri, formatCountdown, toast, navigate, route, todayKey } from './util.js';
import { METHODS, nextPrayerInfo, imsakAndBuka, qiblaFrom } from './prayer.js';
import { initMurotal, renderMurotal } from './murotal.js';
import { initDoa, renderDoa } from './doa.js';
import { renderQibla, stopQibla, paintCompassIn, compassMarkup, enableCompass } from './qibla.js';
import { initAlarm, renderAzan, renderAlarm, tickAlarms, resetAlarmsForNewDay } from './alarm.js';
import { initHalal, renderHalal, stopScan } from './halal.js';

const VIEWS = ['home', 'murotal', 'doa', 'qibla', 'halal', 'azan', 'alarm', 'settings', 'lainnya'];

let cities = [];

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1Z"/></svg>',
  murotal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Z"/><path d="M8 8h8M8 12h8"/></svg>',
  doa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v4M8 6h8"/><path d="M6 20c0-4 2.5-7 6-7s6 3 6 7z"/></svg>',
  qibla: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m12 4 2 8-2 2-2-2 2-8Z"/></svg>',
  halal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16v12H4z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="m9 14 2 2 4-4"/></svg>'
};

function showView(name) {
  for (const v of VIEWS) {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.toggle('active', v === name);
  }
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name || (name === 'lainnya' && t.dataset.view === 'lainnya') || (['azan','alarm','settings','doa'].includes(name) && t.dataset.view === 'lainnya' && name !== 'doa')));
  // Doa has its own tab? We put Doa in Lainnya OR as a tab.
  // Bottom nav: home, murotal, qibla, halal, lainnya
  document.querySelectorAll('.tab').forEach((t) => {
    const map = { home: 'home', murotal: 'murotal', qibla: 'qibla', halal: 'halal' };
    const active = map[name] === t.dataset.view || (t.dataset.view === 'lainnya' && !map[name]);
    t.classList.toggle('active', active);
  });
  if (name !== 'qibla') stopQibla();
  if (name !== 'halal') stopScan();
  const player = document.getElementById('murotal-player');
  if (player) {
    player.style.display = (name === 'murotal' && player.classList.contains('show')) ? 'block' : 'none';
  }
}

function renderHome() {
  const s = getSettings();
  const next = nextPrayerInfo(s);
  const ib = imsakAndBuka(s);
  const q = qiblaFrom(s);
  const view = document.getElementById('view-home');
  const now = new Date();
  const rows = next.all.map((r) => {
    const label = r.alias ? `${r.name} <span class="alias">(${r.alias})</span>` : r.name;
    const isNext = r.key === next.key && !next.isTomorrow;
    return `
    <div class="prayer-row ${isNext ? 'is-next' : ''} ${r.key === 'imsak' ? 'is-imsak' : ''}">
      <span class="dot"></span>
      <span class="name">${label}</span>
      <span class="time">${r.timeLabel}</span>
      <button type="button" class="bell ${s.alarms[r.key] ? 'on' : ''}" data-bell="${r.key}" aria-label="Alarm ${r.name}">${s.alarms[r.key] ? '🔔' : '🔕'}</button>
    </div>`;
  }).join('');
  view.innerHTML = `
    <header class="hero">
      <div class="hero-top">
        <div class="brand">Muslimku<small>Waktu shalat · kiblat · halal</small></div>
        <button type="button" class="loc-btn" id="loc-open">${escapeHtml(s.coords.label)}</button>
      </div>
      <div class="hero-art" id="hero-art"></div>
      <div class="hero-dates">
        <div class="clock" id="live-clock">${formatClock(now, next.tz)}</div>
        <div class="hijri" id="hijri-date">${formatHijri(now, next.tz)}</div>
        <div class="greg" id="greg-date">${formatGregorian(now, next.tz)}</div>
      </div>
    </header>
    <section class="next-card" id="next-card">
      <div class="kicker">${next.isTomorrow ? 'Shalat berikutnya (besok)' : 'Shalat berikutnya'}</div>
      <div class="pname">${next.name}${next.alias ? ` <span class="alias-next">(${next.alias})</span>` : ''}</div>
      <div class="ptime">${next.timeLabel}</div>
      <div class="count" id="countdown">${formatCountdown(next.when - now)}<span>menuju ${next.name}</span></div>
    </section>
    <section class="section">
      <div class="imsak-buka" id="imsak-buka">
        <div class="ib-col">
          <div class="ib-kicker">Imsak</div>
          <div class="ib-time" id="imsak-time">${ib.imsak.todayLabel}</div>
          <div class="ib-count" id="imsak-count">${formatCountdown(ib.imsak.when - now)}${ib.imsak.isTomorrow ? ' <span>(besok)</span>' : ''}</div>
        </div>
        <div class="ib-col">
          <div class="ib-kicker">Buka puasa</div>
          <div class="ib-time" id="buka-time">${ib.buka.todayLabel}</div>
          <div class="ib-count" id="buka-count">${formatCountdown(ib.buka.when - now)}${ib.buka.isTomorrow ? ' <span>(besok)</span>' : ''}</div>
        </div>
      </div>
    </section>
    <section class="section">
      <button type="button" class="qibla-home" id="home-qibla-card" aria-label="Buka halaman kiblat">
        ${compassMarkup('home-compass', 'compass-mini')}
        <div class="qibla-home-text">
          <div class="ib-kicker">Kiblat</div>
          <strong id="home-qibla-deg">${q.bearing.toFixed(1)}°</strong>
          <div class="muted" id="home-qibla-live">Relatif ke utara (atas layar)</div>
          <div class="muted">Ketuk untuk kompas penuh</div>
        </div>
      </button>
    </section>
    <section class="section">
      <div class="card prayer-list">${rows}</div>
    </section>
    <section class="section">
      <h2>Fitur</h2>
      <div class="grid">
        <button type="button" class="tile" data-go="murotal"><span class="glyph">${ICONS.murotal}</span><span>Murotal</span></button>
        <button type="button" class="tile" data-go="doa"><span class="glyph">${ICONS.doa}</span><span>Doa</span></button>
        <button type="button" class="tile" data-go="qibla"><span class="glyph">${ICONS.qibla}</span><span>Kiblat</span></button>
        <button type="button" class="tile" data-go="halal"><span class="glyph">${ICONS.halal}</span><span>Halal Pro</span></button>
        <button type="button" class="tile" data-go="azan"><span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16 9a5 5 0 0 1 0 6"/></svg></span><span>Azan</span></button>
        <button type="button" class="tile" data-go="alarm"><span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 2M9 4h6M5 7l-2 2M19 7l2 2"/></svg></span><span>Alarm</span></button>
      </div>
    </section>
  `;
  const art = document.getElementById('hero-art');
  fetch('assets/art/mosque.svg').then((r) => r.text()).then((svg) => { art.innerHTML = svg; }).catch(() => {});
  document.getElementById('loc-open').addEventListener('click', () => navigate('settings'));
  view.querySelectorAll('.tile').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.go)));
  view.querySelectorAll('[data-bell]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const alarms = { ...getSettings().alarms, [b.dataset.bell]: !getSettings().alarms[b.dataset.bell] };
    saveSettings({ alarms });
    renderHome();
  }));
  document.getElementById('home-qibla-card').addEventListener('click', () => navigate('qibla'));
  refreshHomeQibla();
}

function refreshHomeQibla() {
  const root = document.getElementById('home-compass');
  if (!root) return;
  const q = qiblaFrom(getSettings());
  paintCompassIn(root, q.bearing);
  const deg = document.getElementById('home-qibla-deg');
  if (deg) deg.textContent = `${q.bearing.toFixed(1)}°`;
}

function refreshHomeTimes() {
  const view = document.getElementById('view-home');
  if (!view || !view.classList.contains('active')) {
    if (!document.getElementById('live-clock')) return;
  }
  const s = getSettings();
  const next = nextPrayerInfo(s);
  const ib = imsakAndBuka(s);
  const now = new Date();
  const clock = document.getElementById('live-clock');
  const count = document.getElementById('countdown');
  if (clock) clock.textContent = formatClock(now, next.tz);
  if (count) count.innerHTML = `${formatCountdown(next.when - now)}<span>menuju ${next.name}</span>`;
  const p = document.querySelector('#next-card .pname');
  const tm = document.querySelector('#next-card .ptime');
  const k = document.querySelector('#next-card .kicker');
  if (p && !p.textContent.includes(next.name)) renderHome();
  else {
    if (tm) tm.textContent = next.timeLabel;
    if (k) k.textContent = next.isTomorrow ? 'Shalat berikutnya (besok)' : 'Shalat berikutnya';
  }
  const it = document.getElementById('imsak-time');
  const ic = document.getElementById('imsak-count');
  const bt = document.getElementById('buka-time');
  const bc = document.getElementById('buka-count');
  if (it) it.textContent = ib.imsak.todayLabel;
  if (ic) ic.innerHTML = `${formatCountdown(ib.imsak.when - now)}${ib.imsak.isTomorrow ? ' <span>(besok)</span>' : ''}`;
  if (bt) bt.textContent = ib.buka.todayLabel;
  if (bc) bc.innerHTML = `${formatCountdown(ib.buka.when - now)}${ib.buka.isTomorrow ? ' <span>(besok)</span>' : ''}`;
  refreshHomeQibla();
}

function renderLainnya() {
  const view = document.getElementById('view-lainnya');
  view.innerHTML = `
    <div class="topbar"><h1>Lainnya</h1></div>
    <button class="surah-item" data-go="doa"><div class="num">📿</div><div><div style="font-weight:800">Doa</div><div class="muted">Doa dari Al-Qur'an dan doa harian</div></div><div></div></button>
    <button class="surah-item" data-go="azan"><div class="num">🔊</div><div><div style="font-weight:800">Suara azan</div><div class="muted">Pilih nada azan</div></div><div></div></button>
    <button class="surah-item" data-go="alarm"><div class="num">⏰</div><div><div style="font-weight:800">Alarm shalat</div><div class="muted">Pengingat tiap waktu shalat</div></div><div></div></button>
    <button class="surah-item" data-go="settings"><div class="num">⚙️</div><div><div style="font-weight:800">Pengaturan</div><div class="muted">Metode, lokasi, madzhab</div></div><div></div></button>
    <section class="doa-item">
      <h3>Tentang & sumber</h3>
      <p>Muslimku adalah aplikasi ibadah original (bukan salinan Muslim Pro atau Halal Japan). Waktu shalat dihitung pustaka adhan-js, bawaan <strong>Umm al-Qura</strong> seperti Nusuk, dan menyesuaikan musim (dihitung ulang tiap hari dan saat aplikasi dibuka kembali). Ada Imsak (Subuh dikurangi 10 menit, bisa diubah) dan Buka puasa (= Maghrib). Kiblat: great-circle ke Ka‘bah 21,4225°N, 39,8262°E.</p>
      <p>Murotal: mp3quran.net. Azan: Wikimedia Commons (lihat kredit di menu Azan). Doa Qur'an: api.alquran.cloud (Utsmani + Kemenag). Doa harian: Hisn al-Muslim via hisnmuslim.com. Produk: Open Food Facts. Tempat halal: OpenStreetMap.</p>
    </section>
  `;
  view.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));
}

function renderSettings() {
  const view = document.getElementById('view-settings');
  const s = getSettings();
  const methodOpts = METHODS.map((m) => `<option value="${m.id}" ${s.method === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('');
  const cityOpts = cities.map((c) => `<option value="${c.id}" ${s.cityId === c.id ? 'selected' : ''}>${escapeHtml(c.name_id)} (${escapeHtml(c.country)})</option>`).join('');
  const hint = METHODS.find((m) => m.id === s.method)?.hint || '';
  view.innerHTML = `
    <div class="topbar"><h1>Pengaturan</h1></div>
    <label class="setting-row">Metode waktu shalat
      <select class="select" id="method-sel">${methodOpts}</select>
      <div class="muted" id="method-hint">${escapeHtml(hint)}</div>
    </label>
    <label class="setting-row">Madzhab untuk Ashar
      <select class="select" id="madhab-sel">
        <option value="Shafi" ${s.madhab === 'Shafi' ? 'selected' : ''}>Syafi'i (standar Indonesia & Jepang)</option>
        <option value="Hanafi" ${s.madhab === 'Hanafi' ? 'selected' : ''}>Hanafi</option>
      </select>
    </label>
    <label class="setting-row">Selisih Imsak sebelum Subuh
      <select class="select" id="imsak-offset">
        ${[5,10,15,20].map((n) => `<option value="${n}" ${Number(s.imsakOffset) === n ? 'selected' : ''}>${n} menit (Imsak = Subuh dikurangi ${n} menit)</option>`).join('')}
      </select>
      <div class="muted">Praktik umum di Indonesia adalah 10 menit. Nusuk/Umm al-Qura di aladhan juga memakai 10 menit.</div>
    </label>
    <label class="setting-row">Aturan lintang tinggi (musim dingin di utara)
      <select class="select" id="highlat-sel">
        <option value="auto" ${s.highLat === 'auto' ? 'selected' : ''}>Otomatis</option>
        <option value="middle" ${s.highLat === 'middle' ? 'selected' : ''}>Tengah malam</option>
        <option value="seventh" ${s.highLat === 'seventh' ? 'selected' : ''}>Sepertujuh malam</option>
        <option value="angle" ${s.highLat === 'angle' ? 'selected' : ''}>Sudut senja</option>
      </select>
    </label>
    <label class="setting-row">Kota cadangan
      <select class="select" id="city-sel">${cityOpts}</select>
    </label>
    <div class="setting-row">
      <div class="toggle-title">Halal Pro — minyak dan lemak</div>
      <div class="muted">Minyak/lemak hewani (動物油脂, 牛脂, 魚油, tallow, dll.) selalu ditandai HARAM. Lemak babi tetap HARAM. Minyak/lemak nabati (植物油, パーム油, palm oil, dll.) tidak ditandai. Lemak susu (乳脂肪) tidak ditandai.</div>
    </div>
    <p class="btn-row">
      <button type="button" class="btn" id="use-gps">Gunakan lokasi HP</button>
    </p>
    <p class="note">Lokasi sekarang: ${escapeHtml(s.coords.label)} (${s.coords.lat.toFixed(4)}, ${s.coords.lon.toFixed(4)}) · ${escapeHtml(s.coords.tz)} · sumber: ${escapeHtml(s.coords.source)}</p>
  `;
  $('#method-sel', view).addEventListener('change', (e) => { saveSettings({ method: e.target.value }); renderSettings(); });
  $('#madhab-sel', view).addEventListener('change', (e) => saveSettings({ madhab: e.target.value }));
  $('#imsak-offset', view).addEventListener('change', (e) => saveSettings({ imsakOffset: Number(e.target.value) }));
  $('#highlat-sel', view).addEventListener('change', (e) => saveSettings({ highLat: e.target.value }));
  $('#city-sel', view).addEventListener('change', (e) => applyCity(e.target.value));
  $('#use-gps', view).addEventListener('click', useGps);
}

function applyCity(id) {
  const c = cities.find((x) => x.id === id);
  if (!c) return;
  saveSettings({
    cityId: id,
    useGps: false,
    coords: { lat: c.lat, lon: c.lon, tz: c.tz, label: `${c.name_id}, ${c.country}`, source: 'kota' }
  });
  toast('Lokasi diganti ke ' + c.name_id);
  renderSettings();
}

function useGps() {
  if (!navigator.geolocation) { toast('GPS tidak tersedia.'); return; }
  toast('Meminta lokasi…');
  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
    saveSettings({
      useGps: true,
      coords: { lat, lon, tz, label: `Lokasi HP (${lat.toFixed(3)}, ${lon.toFixed(3)})`, source: 'gps' }
    });
    toast('Lokasi HP tersimpan.');
    renderSettings();
  }, () => toast('Izin lokasi ditolak. Pakai kota cadangan ya.'), { enableHighAccuracy: true, timeout: 10000 });
}

function applyRoute() {
  const r = route();
  const name = VIEWS.includes(r.name) ? r.name : 'home';
  showView(name);
  if (name === 'home') renderHome();
  if (name === 'murotal') renderMurotal();
  if (name === 'doa') renderDoa();
  if (name === 'qibla') renderQibla();
  if (name === 'halal') renderHalal(r.rest[0] === 'contoh', r.rest[1] || '');
  if (name === 'azan') renderAzan();
  if (name === 'alarm') renderAlarm();
  if (name === 'settings') renderSettings();
  if (name === 'lainnya') renderLainnya();
}

async function boot() {
  const cityData = await loadJSON('data/cities.json');
  cities = cityData.cities;
  const s = getSettings();
  if (!s.coords || !s.coords.lat) applyCity(cityData.default_id);
  await Promise.all([initMurotal(), initDoa(), initAlarm(), initHalal()]);
  window.addEventListener('hashchange', applyRoute);
  if (!location.hash) location.hash = '#/home';
  else applyRoute();
  let lastDateKey = todayKey(getSettings().coords.tz);
  function refreshForSeasonAndDay(reason) {
    const s = getSettings();
    const key = todayKey(s.coords.tz);
    const dateChanged = key !== lastDateKey;
    if (dateChanged) {
      lastDateKey = key;
      resetAlarmsForNewDay();
      if (document.getElementById('view-home')?.classList.contains('active')) renderHome();
      else refreshHomeTimes();
      toast('Jadwal shalat hari ini sudah diperbarui (menyesuaikan musim dan tanggal).');
    } else if (reason === 'resume') {
      if (document.getElementById('view-home')?.classList.contains('active')) {
        const hijri = document.getElementById('hijri-date');
        const nowH = formatHijri(new Date(), s.coords.tz);
        if (hijri && hijri.textContent !== nowH) renderHome();
        else refreshHomeTimes();
      }
    } else {
      refreshHomeTimes();
    }
    tickAlarms();
  }
  setInterval(() => refreshForSeasonAndDay('tick'), 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshForSeasonAndDay('resume');
  });
  window.addEventListener('pageshow', () => refreshForSeasonAndDay('resume'));
  window.addEventListener('focus', () => refreshForSeasonAndDay('resume'));
  if (!new URLSearchParams(location.search).has('e2e') && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot().catch((err) => {
  console.error(err);
  toast('Gagal memuat aplikasi. Muat ulang halaman.');
});
