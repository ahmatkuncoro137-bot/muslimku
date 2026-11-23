import { getSettings, haversineKm, KAABA, toast } from './util.js';
import { qiblaFrom } from './prayer.js';

let heading = null;
let running = false;
let handler = null;

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** Simple original Kaaba icon (front face + gold kiswa band + door). */
function kaabaMark() {
  return `
    <g class="kaaba-icon" transform="translate(-11,-20)">
      <rect x="0.5" y="0.5" width="21" height="21" rx="1.2" fill="#1a1a1a" stroke="#c9a84c" stroke-width="0.8"/>
      <rect x="0.5" y="5.5" width="21" height="3.4" fill="#c9a84c"/>
      <rect x="7.5" y="11.5" width="7" height="8" rx="0.4" fill="#2a1c0c" stroke="#c9a84c" stroke-width="0.7"/>
    </g>`;
}

function tickMarks() {
  const parts = [];
  for (let i = 0; i < 72; i++) {
    const major = i % 18 === 0;
    const mid = i % 6 === 0;
    const len = major ? 10 : mid ? 6 : 3.5;
    const sw = major ? 2 : 1;
    parts.push(`<line x1="100" y1="${12 + (10 - len)}" x2="100" y2="12" transform="rotate(${i * 5} 100 100)" stroke="#1f3d32" stroke-width="${sw}" stroke-linecap="round" opacity="${major ? 1 : 0.55}"/>`);
  }
  return parts.join('');
}

export function compassMarkup(id, extraClass = '') {
  const gid = `g-${id}`;
  return `<div class="compass ${extraClass}" id="${id}" role="img" aria-label="Kompas kiblat">
    <svg class="compass-dial" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f7e7a8"/>
          <stop offset="100%" stop-color="#c9a84c"/>
        </linearGradient>
        <filter id="${gid}-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000" flood-opacity="0.28"/>
        </filter>
      </defs>
      <circle cx="100" cy="100" r="97" fill="#1f3d32"/>
      <circle cx="100" cy="100" r="90" fill="#fbfaf6" stroke="#c9a84c" stroke-width="2.5"/>
      <circle cx="100" cy="100" r="78" fill="none" stroke="#e6ddc8" stroke-width="1"/>
      ${tickMarks()}
      <text class="cardinal-svg n" x="100" y="26" text-anchor="middle">U</text>
      <text class="cardinal-svg e" x="176" y="105" text-anchor="middle">T</text>
      <text class="cardinal-svg s" x="100" y="186" text-anchor="middle">S</text>
      <text class="cardinal-svg w" x="24" y="105" text-anchor="middle">B</text>
      <g class="needle" transform="rotate(0 100 100)">
        <polygon points="100,32 105.5,100 94.5,100" fill="#c0362c" opacity="0.95"/>
        <polygon points="100,168 104,100 96,100" fill="#e8b4ae" opacity="0.7"/>
      </g>
      <g class="qibla-needle" transform="rotate(0 100 100)" filter="url(#${gid}-shadow)">
        <polygon points="100,28 107,100 93,100" fill="url(#${gid}-gold)"/>
        <polygon points="100,164 105,100 95,100" fill="#e8d48a" opacity="0.85"/>
        <g transform="translate(100, 22)">${kaabaMark()}</g>
      </g>
      <circle cx="100" cy="100" r="8" fill="#1f3d32" stroke="#fff" stroke-width="2.5"/>
      <circle cx="100" cy="100" r="3" fill="#c9a84c"/>
    </svg>
  </div>`;
}

export function renderQibla() {
  const view = document.getElementById('view-qibla');
  const settings = getSettings();
  const q = qiblaFrom(settings);
  const dist = haversineKm(settings.coords.lat, settings.coords.lon, KAABA.lat, KAABA.lon);
  view.innerHTML = `
    <div class="topbar"><h1>Kiblat & kompas</h1></div>
    <div class="bearing">
      <div class="muted">${escape(settings.coords.label)}</div>
      <strong id="qibla-deg">${q.bearing.toFixed(1)}°</strong>
      <div>dari utara sejati ke arah Ka‘bah</div>
      <div class="muted">Jarak sekitar ${dist.toFixed(0)} km · ${escape(q.formula)}</div>
    </div>
    <div class="compass-wrap">
      ${compassMarkup('compass')}
    </div>
    <p class="btn-row" style="justify-content:center">
      <button type="button" class="btn" id="enable-compass">Aktifkan kompas HP</button>
    </p>
    <p class="note" id="compass-note">Jika kompas belum aktif, anggap bagian atas layar adalah utara (U). Jarum emas menunjuk kiblat, dengan ikon Ka‘bah di ujungnya. Kalibrasikan HP dengan gerakan angka 8. Logam dan sarung HP bisa mengganggu sensor.</p>
    <p class="disclaimer">Arah dihitung dengan rumus great-circle (orthodrome) ke Ka‘bah (21,4225° LU, 39,8262° BT), sama seperti pendekatan aplikasi Nusuk. Ini arah terpendek di permukaan bumi, bukan garis loxodrome.</p>
  `;
  paintCompass(q.bearing);
  document.getElementById('enable-compass').addEventListener('click', enableCompass);
}

export function getHeading() { return heading; }

export function paintCompassIn(root, qiblaDeg, headingVal = heading) {
  if (!root) return;
  const qEl = root.querySelector('.qibla-needle');
  const nEl = root.querySelector('.needle');
  if (!qEl || !nEl) return;
  let qRot = qiblaDeg;
  let nRot = 0;
  if (headingVal != null) {
    qRot = (qiblaDeg - headingVal + 360) % 360;
    nRot = (0 - headingVal + 360) % 360;
  }
  qEl.setAttribute('transform', `rotate(${qRot} 100 100)`);
  nEl.setAttribute('transform', `rotate(${nRot} 100 100)`);
}

function paintCompass(qiblaDeg) {
  const root = document.getElementById('compass');
  paintCompassIn(root, qiblaDeg, heading);
  const mini = document.getElementById('home-compass');
  if (mini) paintCompassIn(mini, qiblaDeg, heading);
  const deg = document.getElementById('home-qibla-deg');
  if (deg) deg.textContent = `${qiblaDeg.toFixed(1)}°`;
  const live = document.getElementById('home-qibla-live');
  if (live) live.textContent = heading == null ? 'Relatif ke utara (atas layar)' : 'Kompas HP aktif';
}

export async function enableCompass() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        toast('Izin kompas ditolak.');
        return;
      }
    }
  } catch {
    toast('Kompas tidak tersedia di perangkat ini.');
    return;
  }
  if (handler) {
    window.removeEventListener('deviceorientationabsolute', handler);
    window.removeEventListener('deviceorientation', handler);
  }
  handler = (ev) => {
    let h = null;
    if (typeof ev.webkitCompassHeading === 'number' && !Number.isNaN(ev.webkitCompassHeading)) {
      h = ev.webkitCompassHeading;
    } else if (typeof ev.alpha === 'number') {
      h = (360 - ev.alpha) % 360;
    }
    if (h == null) return;
    heading = h;
    const q = qiblaFrom(getSettings());
    paintCompass(q.bearing);
    const note = document.getElementById('compass-note');
    if (note) note.textContent = `Kompas aktif. Arahkan HP hingga jarum emas dan ikon Ka‘bah ke atas. Kiblat ${q.bearing.toFixed(1)}° dari utara, heading HP ${heading.toFixed(0)}°.`;
  };
  window.addEventListener('deviceorientationabsolute', handler, true);
  window.addEventListener('deviceorientation', handler, true);
  running = true;
  toast('Kompas diaktifkan. Kalibrasikan jika jarum tidak stabil.');
}

export function stopQibla() {
  /* Keep compass listeners so the home kiblat card stays live after leaving this page. */
}

export function stopCompass() {
  if (handler) {
    window.removeEventListener('deviceorientationabsolute', handler);
    window.removeEventListener('deviceorientation', handler);
    handler = null;
  }
  running = false;
}
