import { $, $all, escapeHtml, getSettings, saveSettings, loadJSON, toast, todayKey } from './util.js';
import { PRAYER_META, computePrayerTimes } from './prayer.js';

let voices = [];
let azanAudio;
const fired = new Set();

export async function initAlarm() {
  const data = await loadJSON('data/azan.json');
  voices = data.voices;
  azanAudio = document.getElementById('azan-audio');
  if (!azanAudio) {
    azanAudio = document.createElement('audio');
    azanAudio.id = 'azan-audio';
    azanAudio.preload = 'auto';
    document.body.appendChild(azanAudio);
  }
  const s = getSettings();
  const v = voices.find((x) => x.id === s.azanId) || voices[0];
  if (!new URLSearchParams(location.search).has('e2e')) {
    azanAudio.src = v.file;
  }
}

export function renderAzan() {
  const view = document.getElementById('view-azan');
  const s = getSettings();
  view.innerHTML = `
    <div class="topbar"><h1>Suara azan</h1></div>
    <p class="note">Pilih nada azan. Berkas disimpan di aplikasi (sumber Wikimedia Commons, lisensi bebas). Kredit wajib ada karena sebagian berkas CC BY-SA.</p>
    ${voices.map((v) => `
      <label class="voice-item">
        <div>
          <div style="font-weight:800">${escapeHtml(v.name_id)}</div>
          <div class="license">${escapeHtml(v.author)} · ${escapeHtml(v.license)}</div>
          <div class="license"><a href="${escapeHtml(v.source_url)}" target="_blank" rel="noopener">Sumber</a></div>
        </div>
        <button type="button" class="btn secondary preview-azan" data-id="${v.id}">Putar</button>
        <input type="radio" name="azan-voice" value="${v.id}" ${s.azanId === v.id ? 'checked' : ''} aria-label="Pilih ${escapeHtml(v.name_id)}">
      </label>
    `).join('')}
  `;
  $all('input[name=azan-voice]', view).forEach((r) => r.addEventListener('change', () => {
    saveSettings({ azanId: r.value });
    const v = voices.find((x) => x.id === r.value);
    azanAudio.src = v.file;
    toast('Suara azan disimpan.');
  }));
  $all('.preview-azan', view).forEach((b) => b.addEventListener('click', () => preview(b.dataset.id)));
}

export function renderAlarm() {
  const view = document.getElementById('view-alarm');
  const s = getSettings();
  const alarmItems = [
    { key: 'imsak', name: 'Imsak' },
    ...PRAYER_META.map((p) => ({ key: p.key, name: p.alias ? `${p.name} (Buka puasa)` : p.name }))
  ];
  const rows = alarmItems.map((p) => `
    <label class="setting-row inline">
      <span style="font-weight:800">${p.name}</span>
      <input type="checkbox" data-alarm="${p.key}" ${s.alarms[p.key] ? 'checked' : ''}>
    </label>
  `).join('');
  view.innerHTML = `
    <div class="topbar"><h1>Alarm shalat</h1></div>
    <p class="note"><strong>Penting:</strong> di aplikasi web (PWA), azan dijamin berbunyi hanya selama aplikasi terbuka atau berjalan di latar depan. Sistem HP (terutama iPhone) biasanya mematikan timer jika aplikasi ditutup. Setelah jadi aplikasi Android (Play Store / Capacitor), alarm bisa dipasang sebagai notifikasi lokal sistem.</p>
    ${rows}
    <label class="setting-row">Pengingat lebih awal (menit)
      <select class="select" id="early-min">
        ${[0,5,10,15,20].map((n) => `<option value="${n}" ${s.earlyMinutes === n ? 'selected' : ''}>${n === 0 ? 'Tepat waktu' : n + ' menit sebelumnya'}</option>`).join('')}
      </select>
    </label>
    <p class="btn-row">
      <button type="button" class="btn" id="ask-notif">Izinkan notifikasi</button>
      <button type="button" class="btn secondary" id="test-azan">Uji bunyi azan</button>
    </p>
    <p class="muted" style="padding:0 16px">Suara yang dipakai: lihat menu Azan. Notifikasi muncul jika izin diberikan dan halaman masih hidup.</p>
  `;
  $all('[data-alarm]', view).forEach((cb) => cb.addEventListener('change', () => {
    const alarms = { ...getSettings().alarms, [cb.dataset.alarm]: cb.checked };
    saveSettings({ alarms });
  }));
  $('#early-min', view).addEventListener('change', (e) => saveSettings({ earlyMinutes: Number(e.target.value) }));
  $('#ask-notif', view).addEventListener('click', askNotif);
  $('#test-azan', view).addEventListener('click', () => preview(getSettings().azanId));
}

async function askNotif() {
  if (!('Notification' in window)) { toast('Notifikasi tidak didukung browser ini.'); return; }
  const perm = await Notification.requestPermission();
  saveSettings({ notificationsAsked: true });
  toast(perm === 'granted' ? 'Notifikasi diizinkan, selama aplikasi terbuka.' : 'Izin notifikasi tidak diberikan.');
}

function preview(id) {
  const v = voices.find((x) => x.id === id) || voices[0];
  azanAudio.src = v.file;
  azanAudio.currentTime = 0;
  azanAudio.play().catch(() => toast('Ketuk lagi untuk memutar azan.'));
}

export function tickAlarms(now = new Date()) {
  const s = getSettings();
  const { rows, tz } = computePrayerTimes(now, s);
  const early = (s.earlyMinutes || 0) * 60 * 1000;
  for (const row of rows) {
    if (!s.alarms[row.key]) continue;
    const fireAt = new Date(row.when.getTime() - early);
    const key = `${todayKey(tz)}-${row.key}-${s.earlyMinutes || 0}`;
    if (fired.has(key)) continue;
    if (now >= fireAt && now < fireAt.getTime() + 60 * 1000) {
      fired.add(key);
      triggerAlarm(row, s);
    }
  }
}

function triggerAlarm(row, s) {
  const v = voices.find((x) => x.id === s.azanId) || voices[0];
  azanAudio.src = v.file;
  azanAudio.play().catch(() => {});
  const banner = document.getElementById('alarm-banner');
  banner.innerHTML = `<strong>Waktu ${escapeHtml(row.name)}</strong><div>${row.timeLabel}</div><button type="button" class="btn secondary" id="stop-azan" style="margin-top:8px">Hentikan</button>`;
  banner.classList.add('show');
  document.getElementById('stop-azan').addEventListener('click', () => {
    azanAudio.pause();
    azanAudio.currentTime = 0;
    banner.classList.remove('show');
  });
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`Waktu ${row.name}`, { body: `Sekarang waktu ${row.name} (${row.timeLabel}).`, icon: 'assets/icons/icon-192.png' });
    } catch { /* ignore */ }
  }
}

export function resetAlarmsForNewDay() {
  fired.clear();
}

export function stopAzan() {
  if (azanAudio) { azanAudio.pause(); azanAudio.currentTime = 0; }
}

// used by home bells
export { voices };
