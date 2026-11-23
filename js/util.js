export const KAABA = { lat: 21.4225, lon: 39.8262 };

export function $(sel, root = document) { return root.querySelector(sel); }
export function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Gagal memuat ${path}: ${res.status}`);
  return res.json();
}

const STORE = 'muslimku-settings-v1';

export function defaultSettings() {
  return {
    method: 'UmmAlQura',
    madhab: 'Shafi',
    highLat: 'auto',
    cityId: 'tokyo',
    useGps: false,
    coords: { lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo', label: 'Tokyo, Jepang', source: 'kota' },
    azanId: 'makkah-haram',
    alarms: { imsak: false, fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true },
    imsakOffset: 10,
    earlyMinutes: 0,
    reciterId: 'alafasy',
    notificationsAsked: false
  };
}

export function getSettings() {
  const d = defaultSettings();
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return d;
    const parsed = JSON.parse(raw);
    return { ...d, ...parsed, alarms: { ...d.alarms, ...(parsed.alarms || {}) } };
  } catch {
    return d;
  }
}

export function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(STORE, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('muslimku:settings', { detail: next }));
  return next;
}

export function formatTime(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || '00';
  return `${get('hour')}:${get('minute')}`;
}

export function formatClock(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || '00';
  return `${get('hour')}:${get('minute')}:${get('second')}`;
}

export function formatGregorian(date, tz) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz
  }).format(date);
}

export function formatHijri(date, tz) {
  try {
    return new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('id-ID-u-ca-islamic', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: tz
    }).format(date);
  }
}

export function formatCountdown(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function todayKey(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function toast(msg, ms = 2800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function navigate(hash) {
  if (!hash.startsWith('#/')) hash = '#/' + hash.replace(/^#?\/?/, '');
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

export function route() {
  const raw = (location.hash || '#/home').replace(/^#\/?/, '');
  const [name, ...rest] = raw.split('/');
  return { name: name || 'home', rest };
}

export function greatCircleQibla(lat, lon) {
  const φ1 = lat * Math.PI / 180;
  const φ2 = KAABA.lat * Math.PI / 180;
  const Δλ = (KAABA.lon - lon) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
}

export function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
