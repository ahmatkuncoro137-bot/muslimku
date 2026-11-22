import { $, $all, escapeHtml, loadJSON, toast } from './util.js';

let quranDoa = null;
let harian = null;
let tab = 'quran';
let ayahAudio;

export async function initDoa() {
  const [q, h] = await Promise.all([loadJSON('data/doa-quran.json'), loadJSON('data/doa-harian.json')]);
  quranDoa = q;
  harian = h;
  ayahAudio = document.getElementById('ayah-audio');
  if (!ayahAudio) {
    ayahAudio = document.createElement('audio');
    ayahAudio.id = 'ayah-audio';
    ayahAudio.preload = 'none';
    document.body.appendChild(ayahAudio);
  }
}

function ayahBlocks(ayahs) {
  return ayahs.map((a) => `
    <article class="ayah-block">
      <div class="ayah-ref">${escapeHtml(a.surah_name_en)} ${a.surah}:${a.ayah}</div>
      <div class="arabic">${escapeHtml(a.uthmani)}</div>
      <div class="latin">
        <span class="latin-note">Latin (bantuan baca, ikuti teks Arab)</span>
        ${escapeHtml(a.transliteration)}
      </div>
      <div class="arti"><strong>Terjemah Kemenag:</strong> ${escapeHtml(a.kemenag_id)}</div>
      <p><button type="button" class="play-ayah" data-src="${escapeHtml(a.audio_islamic_network)}" data-fallback="${escapeHtml(a.audio_everyayah)}">▶ Putar ayat</button></p>
    </article>
  `).join('');
}

export function renderDoa(filter = '') {
  const view = document.getElementById('view-doa');
  if (!view || !quranDoa) return;
  const q = filter.trim().toLowerCase();
  let body = '';
  if (tab === 'quran') {
    const groups = quranDoa.groups.filter((g) => {
      const blob = `${g.title_id} ${g.reference} ${g.ayahs.map((a) => a.kemenag_id).join(' ')}`.toLowerCase();
      return !q || blob.includes(q);
    });
    body = groups.map((g) => `
      <section class="doa-item">
        <h3 style="margin:0 0 6px">${escapeHtml(g.title_id)}</h3>
        <div class="muted">QS. ${escapeHtml(g.reference)}</div>
        ${ayahBlocks(g.ayahs)}
      </section>
    `).join('') || '<p class="empty">Tidak ada doa yang cocok.</p>';
  } else {
    const cats = harian.categories.filter((c) => {
      const blob = `${c.title_id} ${c.title_en} ${c.items.map((i) => i.english + i.arabic).join(' ')}`.toLowerCase();
      return !q || blob.includes(q);
    });
    body = cats.map((c) => `
      <section class="doa-item">
        <h3 style="margin:0 0 6px">${escapeHtml(c.title_id)}</h3>
        <div class="muted">${escapeHtml(c.title_en)}</div>
        ${c.items.map((it) => `
          <article class="ayah-block">
            <div class="arabic">${escapeHtml(it.arabic)}</div>
            ${it.transliteration ? `<div class="latin"><span class="latin-note">Latin (bantuan baca, ikuti teks Arab)</span>${escapeHtml(it.transliteration)}</div>` : ''}
            <div class="arti"><strong>Arti (Inggris, sumber Hisn al-Muslim):</strong> ${escapeHtml(it.english)}</div>
            ${it.contains_non_uthmani_quran_quote ? '<p class="muted">Teks ini memuat kutipan ayat dengan tipografi non-Utsmani dari Hisn al-Muslim. Untuk teks Utsmani ayat terkait, lihat tab Doa dari Al-Qur\'an (mis. 43:13-14 pada doa safar).</p>' : ''}
            <div class="license">Sumber: ${escapeHtml(it.source)}. Diambil dari hisnmuslim.com (kategori ${it.hisn_category_id}, item ${it.hisn_item_id}). Nomor riwayat tidak kami tambahkan sendiri karena API tidak menyertakannya.</div>
            ${it.repeat && it.repeat > 1 ? `<div class="muted">Dibaca ${it.repeat} kali.</div>` : ''}
          </article>
        `).join('')}
      </section>
    `).join('') || '<p class="empty">Tidak ada doa yang cocok.</p>';
  }
  view.innerHTML = `
    <div class="topbar"><h1>Doa</h1></div>
    <div class="tabs">
      <button type="button" data-tab="quran" class="${tab === 'quran' ? 'active' : ''}">Doa dari Al-Qur'an</button>
      <button type="button" data-tab="harian" class="${tab === 'harian' ? 'active' : ''}">Doa harian</button>
    </div>
    <div class="toolbar"><input class="search" id="doa-search" placeholder="Cari doa atau ayat..." value="${escapeHtml(filter)}"></div>
    ${body}
    <p class="note">${tab === 'quran'
      ? 'Teks Arab: edisi Utsmani api.alquran.cloud (quran-uthmani), disimpan apa adanya dan diverifikasi byte-per-byte. Terjemah: id.indonesian (Kemenag). Latin hanya bantuan baca — ikuti teks Arab.'
      : harian.meta.note}</p>
  `;
  $all('.tabs button', view).forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    renderDoa($('#doa-search', view)?.value || '');
  }));
  $('#doa-search', view).addEventListener('input', (e) => renderDoa(e.target.value));
  $all('.play-ayah', view).forEach((btn) => btn.addEventListener('click', () => playAyah(btn)));
}

function playAyah(btn) {
  const src = btn.dataset.src;
  const fallback = btn.dataset.fallback;
  ayahAudio.onerror = () => {
    if (fallback && ayahAudio.src !== new URL(fallback, location.href).href && !ayahAudio.dataset.triedFallback) {
      ayahAudio.dataset.triedFallback = '1';
      ayahAudio.src = fallback;
      ayahAudio.play().catch(() => toast('Audio ayat tidak dapat diputar.'));
    } else {
      toast('Audio ayat tidak dapat diputar.');
    }
  };
  delete ayahAudio.dataset.triedFallback;
  ayahAudio.src = src;
  ayahAudio.play().catch(() => toast('Ketuk lagi untuk memutar ayat.'));
}
