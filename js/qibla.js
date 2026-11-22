import { getSettings, haversineKm, KAABA, toast } from './util.js';
import { qiblaFrom } from './prayer.js';

let heading = null;
let running = false;
let handler = null;

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
      <div class="compass" id="compass" aria-label="Kompas kiblat">
        <div class="cardinal n">U</div>
        <div class="cardinal e">T</div>
        <div class="cardinal s">S</div>
        <div class="cardinal w">B</div>
        <div class="qibla-needle" id="qibla-needle"></div>
        <div class="needle" id="north-needle"></div>
        <div class="compass-center"></div>
      </div>
    </div>
    <p class="btn-row" style="justify-content:center">
      <button type="button" class="btn" id="enable-compass">Aktifkan kompas HP</button>
    </p>
    <p class="note" id="compass-note">Jika kompas belum aktif, anggap bagian atas layar adalah utara. Jarum emas menunjuk kiblat. Kalibrasikan HP dengan gerakan angka 8. Logam dan sarung HP bisa mengganggu sensor.</p>
    <p class="disclaimer">Arah dihitung dengan rumus great-circle (orthodrome) ke Ka‘bah (21,4225° LU, 39,8262° BT), sama seperti pendekatan aplikasi Nusuk. Ini arah terpendek di permukaan bumi, bukan garis loxodrome.</p>
  `;
  paintCompass(q.bearing);
  document.getElementById('enable-compass').addEventListener('click', enableCompass);
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function getHeading() { return heading; }

export function paintCompassIn(root, qiblaDeg, headingVal = heading) {
  if (!root) return;
  const qEl = root.querySelector('.qibla-needle');
  const nEl = root.querySelector('.needle');
  if (!qEl || !nEl) return;
  if (headingVal == null) {
    nEl.style.transform = 'rotate(0deg)';
    qEl.style.transform = `rotate(${qiblaDeg}deg)`;
  } else {
    const qRel = (qiblaDeg - headingVal + 360) % 360;
    const nRel = (0 - headingVal + 360) % 360;
    nEl.style.transform = `rotate(${nRel}deg)`;
    qEl.style.transform = `rotate(${qRel}deg)`;
  }
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

async function enableCompass() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        toast('Izin kompas ditolak.');
        return;
      }
    }
  } catch (err) {
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
    if (note) note.textContent = `Kompas aktif. Arahkan HP hingga jarum emas ke atas. Kiblat ${q.bearing.toFixed(1)}° dari utara, heading HP ${heading.toFixed(0)}°.`;
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


export function compassMarkup(id, extraClass = '') {
  return `<div class="compass ${extraClass}" id="${id}" aria-label="Kompas kiblat">
        <div class="cardinal n">U</div>
        <div class="cardinal e">T</div>
        <div class="cardinal s">S</div>
        <div class="cardinal w">B</div>
        <div class="qibla-needle"></div>
        <div class="needle"></div>
        <div class="compass-center"></div>
      </div>`;
}

export { enableCompass };
