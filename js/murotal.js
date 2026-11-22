import { $, $all, escapeHtml, loadJSON, getSettings, saveSettings, toast } from './util.js';

let surahs = [];
let reciters = [];
let audio;
let current = { surah: 1, reciter: 'alafasy' };

function pad(n) { return String(n).padStart(3, '0'); }

function srcFor(reciterId, surahNo) {
  const r = reciters.find((x) => x.id === reciterId) || reciters[0];
  return r.base + pad(surahNo) + '.mp3';
}

export async function initMurotal() {
  const [s, r] = await Promise.all([loadJSON('data/surahs.json'), loadJSON('data/reciters.json')]);
  surahs = s.surahs;
  reciters = r.reciters;
  current.reciter = getSettings().reciterId || reciters[0].id;
  audio = document.getElementById('murotal-audio');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'murotal-audio';
    audio.preload = 'none';
    document.body.appendChild(audio);
  }
  audio.addEventListener('timeupdate', syncPlayer);
  audio.addEventListener('ended', playNext);
  audio.addEventListener('error', () => toast('Audio murotal gagal diputar. Periksa koneksi.'));
  renderMurotal();
}

export function renderMurotal(filter = '') {
  const view = document.getElementById('view-murotal');
  if (!view) return;
  const q = filter.trim().toLowerCase();
  const list = surahs.filter((s) => {
    const blob = `${s.number} ${s.name_latin} ${s.name_ar} ${s.meaning_id}`.toLowerCase();
    return !q || blob.includes(q);
  });
  const recOpts = reciters.map((r) =>
    `<option value="${r.id}" ${r.id === current.reciter ? 'selected' : ''}>${escapeHtml(r.name_id)}</option>`
  ).join('');
  const items = list.map((s) => `
    <button class="surah-item" data-surah="${s.number}">
      <div class="num">${s.number}</div>
      <div>
        <div style="font-weight:800">${escapeHtml(s.name_latin)}</div>
        <div class="muted">${escapeHtml(s.meaning_id)} · ${s.ayah_count} ayat · ${escapeHtml(s.revelation)}</div>
      </div>
      <div class="ar">${escapeHtml(s.name_ar)}</div>
    </button>
  `).join('');
  view.innerHTML = `
    <div class="topbar"><h1>Murotal</h1></div>
    <div class="toolbar">
      <label class="muted">Pilih qari (nada / gaya bacaan)</label>
      <select class="select" id="reciter-select">${recOpts}</select>
      <input class="search" id="surah-search" placeholder="Cari surat..." value="${escapeHtml(filter)}">
    </div>
    <div>${items || '<p class="empty">Tidak ada surat yang cocok.</p>'}</div>
    <p class="note">Audio di-stream dari mp3quran.net. 114 surat, riwayat Hafs, berbagai qari. Kami tidak menyimpan berkas audio Al-Qur'an di aplikasi.</p>
  `;
  $('#reciter-select', view).addEventListener('change', (e) => {
    current.reciter = e.target.value;
    saveSettings({ reciterId: current.reciter });
    if (audio && !audio.paused) playSurah(current.surah, false);
  });
  $('#surah-search', view).addEventListener('input', (e) => renderMurotal(e.target.value));
  $all('.surah-item', view).forEach((btn) => {
    btn.addEventListener('click', () => playSurah(Number(btn.dataset.surah), true));
  });
}

export function playSurah(num, autoplay = true) {
  current.surah = num;
  const s = surahs.find((x) => x.number === num);
  const r = reciters.find((x) => x.id === current.reciter) || reciters[0];
  const player = document.getElementById('murotal-player');
  player.classList.add('show');
  player.style.display = 'block';
  player.innerHTML = `
    <div class="who">${escapeHtml(r.name_id)} · ${escapeHtml(r.style)}</div>
    <div class="title">${num}. ${escapeHtml(s.name_latin)}</div>
    <div class="controls">
      <button type="button" id="prev-surah" aria-label="Sebelumnya">⏮</button>
      <button type="button" class="play" id="toggle-surah" aria-label="Putar atau jeda">▶</button>
      <button type="button" id="next-surah" aria-label="Berikutnya">⏭</button>
      <input type="range" id="murotal-seek" min="0" max="1000" value="0" aria-label="Posisi audio">
    </div>
  `;
  const isE2e = new URLSearchParams(location.search).has('e2e');
  if (isE2e) {
    audio.removeAttribute('src');
  } else {
    audio.src = srcFor(current.reciter, num);
    if (autoplay) audio.play().catch(() => toast('Ketuk tombol putar untuk memulai.'));
  }
  $('#toggle-surah', player).addEventListener('click', togglePlay);
  $('#prev-surah', player).addEventListener('click', () => playSurah(num > 1 ? num - 1 : 114, true));
  $('#next-surah', player).addEventListener('click', playNext);
  $('#murotal-seek', player).addEventListener('input', (e) => {
    if (!audio.duration) return;
    audio.currentTime = (Number(e.target.value) / 1000) * audio.duration;
  });
  syncPlayer();
}

function playNext() { playSurah(current.surah >= 114 ? 1 : current.surah + 1, true); }

function togglePlay() {
  if (audio.paused) audio.play(); else audio.pause();
  syncPlayer();
}

function syncPlayer() {
  const player = document.getElementById('murotal-player');
  if (!player || !player.classList.contains('show')) return;
  const btn = $('#toggle-surah', player);
  if (btn) btn.textContent = audio.paused ? '▶' : '⏸';
  const seek = $('#murotal-seek', player);
  if (seek && audio.duration && document.activeElement !== seek) {
    seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
  }
}
