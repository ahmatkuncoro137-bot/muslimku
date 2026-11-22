# Muslimku — sumber, lisensi, dan batas kemampuan

Aplikasi original bernama **Muslimku** (bukan salinan Muslim Pro atau Halal Japan). Desain, ikon, dan ilustrasi masjid dibuat sendiri.

## Waktu shalat dan kiblat

- Perhitungan waktu: pustaka [adhan-js v4.4.6](https://github.com/batoulapps/adhan-js) (lisensi MIT), dibundle di `js/vendor/adhan.umd.min.js`.
- Bawaan metode **Umm al-Qura** (Arab Saudi), seperti aplikasi Nusuk. Pengguna bisa ganti ke Kemenag RI (Subuh 20°, Isya 18°), Muslim World League, Mesir, Singapura (MUIS), atau Turki Diyanet.
- Madzhab Ashar: Syafi'i (bawaan) atau Hanafi.
- Tanggal Hijriah: kalender `islamic-umalqura` lewat `Intl` (kalender Umm al-Qura).
- Kiblat: rumus great-circle / `adhan.Qibla` ke Ka‘bah **21,4225° LU, 39,8262° BT**. Kompas memakai `DeviceOrientation` / `webkitCompassHeading`; jika ditolak, jarum dihitung dari utara di sisi atas layar. Kota cadangan termasuk kota-kota Jepang dan Sukoharjo.

## Murotal

- 114 surat, metadata nama dari [equran.id API v2](https://equran.id/api/v2/surat).
- Audio di-stream dari [mp3quran.net](https://mp3quran.net) / `cdn.mp3quran.net` (tidak di-host di aplikasi). URL qari diverifikasi HTTP 200 `audio/mpeg` (contoh `.../mishary-alafasy/r1/001.mp3`). Pemakaian mengikuti ketentuan mp3quran.net.

## Azan

Berkas disimpan lokal di `assets/azan/`, diunduh dari Wikimedia Commons:

| Berkas | Penulis | Lisensi | Sumber |
|---|---|---|---|
| azan-adam-synagda.mp3 | Adam-synagda | CC0 1.0 | [Beautiful adhan.ogg](https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg) |
| azan-andrewler.mp3 | Andrewler | CC BY-SA 4.0 | [Azan.ogg](https://commons.wikimedia.org/wiki/File:Azan.ogg) |
| azan-sabah-fakhry.mp3 | Sabah Fakhri | Domain publik | [Call to prayer by Sabah Fakhry.mp3](https://commons.wikimedia.org/wiki/File:Call_to_prayer_by_Sabah_Fakhry.mp3) |
| azan-aaqib-azeez.mp3 | Aaqib Azeez / Atcovi | CC BY-SA 4.0 | [The Adhan - Aaqib Azeez.mp3](https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3) |
| azan-mahfoudou.mp3 | Mahfoudou | CC BY-SA 4.0 | [Islamic call to worship.oga](https://commons.wikimedia.org/wiki/File:Islamic_call_to_worship.oga) |

Atribusi ditampilkan di menu Azan (wajib untuk CC BY-SA).

## Doa dari Al-Qur'an

Teks Arab **tidak pernah diketik tangan**. Diambil programatis dari [api.alquran.cloud](https://api.alquran.cloud):

- Arab: edisi `quran-uthmani`
- Terjemah Indonesia: edisi `id.indonesian` (teks Kemenag / Kementerian Agama RI; contoh Al-Fatihah 1: "Dengan menyebut nama Allah Yang Maha Pemurah lagi Maha Penyayang.")
- Latin: edisi `en.transliteration`, dilabeli "bantuan baca, ikuti teks Arab"

Skrip: `scripts/fetch_worship_texts.py`. Tes ulang byte-per-byte: `node tests/verify-ayahs.mjs` (membandingkan UTF-8 persis dengan API live).

Audio per ayat (opsional): `cdn.islamic.network` (ar.alafasy) dengan cadangan `everyayah.com`.

## Doa harian

Arab, latin, dan terjemah Inggris diambil dari [hisnmuslim.com](https://www.hisnmuslim.com/) — digitalisasi **Hisn al-Muslim** karya Sa'id bin Wahf Al-Qahtani. Kutipan ayat yang hanya berupa potongan Qur'an non-Utsmani dilewati (lihat tab Doa dari Al-Qur'an). API tidak menyertakan nomor riwayat (Bukhari/Muslim); kami **tidak menambah nomor sendiri**. Tes `verify-ayahs.mjs` juga memverifikasi teks Arab Hisn byte-per-byte.

## Halal Pro

- Pemindai: `BarcodeDetector` (jika ada) atau [html5-qrcode 2.3.8](https://github.com/mebjas/html5-qrcode) (Apache-2.0).
- Data produk: [Open Food Facts API v2](https://world.openfoodfacts.org/).
- Pemeriksa bahan kurasi (JP/EN) di `data/ingredients.json`. Istilah `酒` tidak dihitung di dalam `醤油`.
- OCR opsional: tesseract.js (jpn+eng) dimuat on-demand dari jsDelivr, tidak dibundle.
- Pencari tempat: OpenStreetMap Overpass, tag `diet:halal` / `cuisine=halal`.
- Hasil **bukan fatwa** dan tidak pernah dinyatakan pasti.
- Preferensi pemilik: minyak/lemak **hewani** (動物油脂, 牛脂, 魚油, tallow, dll.) selalu ditandai **HARAM**. Lemak babi (ラード, 豚脂, lard, pork fat, ポークエキス) tetap HARAM. Minyak/lemak **nabati** (植物油, パーム油, palm oil, dll.) **tidak ditandai**. **乳脂肪** (lemak susu) tidak ditandai.
- Produk dengan minyak/lemak hewani **tidak** boleh berstatus HALAL, meskipun ada label halal di Open Food Facts.

## Alarm (batas PWA)

Azan dan notifikasi dijamin hanya saat aplikasi terbuka / di latar depan. iOS dan banyak Android mematikan timer jika PWA ditutup atau HP tidur. Rencana aplikasi Play Store: notifikasi lokal Capacitor. Ini tercantum di layar Alarm.

## Font

Plus Jakarta Sans dan Noto Naskh Arabic (SIL Open Font License), disalin ke `assets/fonts/`.

## Imsak dan Buka puasa

- Imsak bawaan: Subuh dikurangi 10 menit (praktik umum Indonesia; sama dengan Imsak di API aladhan method=4). Offset bisa diubah di Pengaturan (5/10/15/20 menit).
- Buka puasa = waktu Maghrib (ditampilkan di kartu beranda dan sebagai label pada Maghrib).
- Waktu dihitung ulang setiap hari (pergantian tanggal di zona kota) dan saat aplikasi dibuka kembali, jadi mengikuti musim di Jepang secara otomatis.
- Pembanding: [aladhan.com API](https://aladhan.com/prayer-times-api) method=4 (Umm Al-Qura) untuk Tokyo. Lihat `tests/test-seasons.mjs`.

## Muhammad Thoha (Muhammad Taha Al-Junayd)

Pencarian (2026-11-23):

- **mp3quran.net API v3** (EN+AR, 244 qari): tidak ada Muhammad Taha/Thoha Al-Junayd (satu-satunya "Junaid" adalah *Junaid Adam Abdullah*, orang lain).
- **everyayah.com/data/recitations.js** dan listing folder: tidak ada.
- **quranicaudio.com/api/qaris** (177 qari): tidak ada.
- **api.alquran.cloud audio editions**: tidak ada.
- Assabile menampilkan 64 surat (bukan 114) tanpa CDN stream yang kami verifikasi sebagai sumber resmi yang boleh di-hotlink seperti mp3quran.
- **Azan** atas namanya ada di Internet Archive ("ADZAN around the world" / "Collection Adzan of world" oleh JpnMuslim), file MP3 bisa diunduh, tetapi lisensinya **CC BY-NC-ND 4.0** (non-komersial, tanpa turunan). Tidak kami sertakan, karena aplikasi ini direncanakan ke Play Store/AdMob dan lisensi itu tidak jelas boleh dibundle.
- islamdownload.net juga menampilkan tautan, tanpa lisensi yang jelas; tidak dipakai.

**Kesimpulan:** murotal lengkap dan azan yang bisa dibagikan secara sah **belum ditemukan**. Tidak kami tambahkan URL yang dikarang.
