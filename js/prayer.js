import { getSettings, formatTime, greatCircleQibla } from './util.js';

export const PRAYER_META = [
  { key: 'fajr', name: 'Subuh' },
  { key: 'sunrise', name: 'Syuruq' },
  { key: 'dhuhr', name: 'Dzuhur' },
  { key: 'asr', name: 'Ashar' },
  { key: 'maghrib', name: 'Maghrib', alias: 'Buka puasa' },
  { key: 'isha', name: 'Isya' }
];

export const METHODS = [
  { id: 'UmmAlQura', label: 'Umm al-Qura (seperti Nusuk)', hint: 'Metode resmi Arab Saudi, bawaan aplikasi Nusuk. Waktu menyesuaikan musim secara otomatis.' },
  { id: 'Kemenag', label: 'Kemenag RI', hint: 'Sudut Subuh 20° dan Isya 18°, seperti pedoman Kementerian Agama RI.' },
  { id: 'MWL', label: 'Muslim World League', hint: 'Sering dipakai komunitas Muslim di Jepang dan banyak negara.' },
  { id: 'Egypt', label: 'Otoritas Mesir', hint: 'Egyptian General Authority of Survey.' },
  { id: 'Singapore', label: 'Singapura (MUIS)', hint: 'Metode MUIS, relevan Asia Timur/Tenggara.' },
  { id: 'Turkey', label: 'Turki (Diyanet)', hint: 'Metode Direktorat Urusan Agama Turki.' }
];

/** Civil Y-M-D in a timezone, then a Date whose local YMD matches (adhan-js reads local components). */
export function civilDateInZone(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

export function dateForCalcFromCivil(y, m, d) {
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function dateForCalc(now, tz) {
  const { y, m, d } = civilDateInZone(now, tz);
  return dateForCalcFromCivil(y, m, d);
}

function buildParams(settings) {
  if (typeof adhan === 'undefined') throw new Error('Pustaka adhan-js belum termuat');
  let params;
  switch (settings.method) {
    case 'Kemenag':
      params = new adhan.CalculationParameters('Kemenag', 20, 18);
      break;
    case 'MWL':
      params = adhan.CalculationMethod.MuslimWorldLeague();
      break;
    case 'Egypt':
      params = adhan.CalculationMethod.Egyptian();
      break;
    case 'Singapore':
      params = adhan.CalculationMethod.Singapore();
      break;
    case 'Turkey':
      params = adhan.CalculationMethod.Turkey();
      break;
    case 'UmmAlQura':
    default:
      params = adhan.CalculationMethod.UmmAlQura();
      break;
  }
  params.madhab = settings.madhab === 'Hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  if (settings.highLat === 'middle') params.highLatitudeRule = adhan.HighLatitudeRule.MiddleOfTheNight;
  else if (settings.highLat === 'seventh') params.highLatitudeRule = adhan.HighLatitudeRule.SeventhOfTheNight;
  else if (settings.highLat === 'angle') params.highLatitudeRule = adhan.HighLatitudeRule.TwilightAngle;
  else if (Math.abs(settings.coords.lat) >= 48) params.highLatitudeRule = adhan.HighLatitudeRule.MiddleOfTheNight;
  return params;
}

export function computePrayerTimes(date = new Date(), settings = getSettings()) {
  const tz = settings.coords.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const calcDate = dateForCalc(date, tz);
  const params = buildParams(settings);
  const coords = new adhan.Coordinates(settings.coords.lat, settings.coords.lon);
  const pt = new adhan.PrayerTimes(coords, calcDate, params);
  const offsetMin = Number(settings.imsakOffset ?? 10);
  const imsakWhen = new Date(pt.fajr.getTime() - offsetMin * 60 * 1000);
  const rows = [
    { key: 'imsak', name: 'Imsak', when: imsakWhen, timeLabel: formatTime(imsakWhen, tz), isExtra: true }
  ];
  for (const p of PRAYER_META) {
    const when = pt[p.key];
    rows.push({
      ...p,
      when,
      timeLabel: formatTime(when, tz)
    });
  }
  const { y, m, d } = civilDateInZone(date, tz);
  return { pt, rows, tz, params, civil: { y, m, d }, imsakOffset: offsetMin };
}

export function computePrayerTimesForCivil(y, m, d, settings = getSettings()) {
  const noon = dateForCalcFromCivil(y, m, d);
  return computePrayerTimes(noon, { ...settings, coords: { ...settings.coords } });
}

export function nextPrayerInfo(settings = getSettings(), now = new Date()) {
  const today = computePrayerTimes(now, settings);
  for (const row of today.rows) {
    if (row.when > now) {
      return { ...row, isTomorrow: false, tz: today.tz, all: today.rows, pt: today.pt, civil: today.civil };
    }
  }
  const { y, m, d } = today.civil;
  const nextCivil = new Date(y, m - 1, d + 1, 12, 0, 0);
  const tomorrow = computePrayerTimes(nextCivil, settings);
  const row = tomorrow.rows[0];
  return { ...row, isTomorrow: true, tz: tomorrow.tz, all: today.rows, pt: today.pt, civil: today.civil, tomorrowRows: tomorrow.rows };
}

export function imsakAndBuka(settings = getSettings(), now = new Date()) {
  const today = computePrayerTimes(now, settings);
  const imsak = today.rows.find((r) => r.key === 'imsak');
  const buka = today.rows.find((r) => r.key === 'maghrib');
  const { y, m, d } = today.civil;
  let imsakWhen = imsak.when;
  let bukaWhen = buka.when;
  let imsakTomorrow = false;
  let bukaTomorrow = false;
  if (now >= imsakWhen) {
    const tom = computePrayerTimes(new Date(y, m - 1, d + 1, 12, 0, 0), settings);
    imsakWhen = tom.rows.find((r) => r.key === 'imsak').when;
    imsakTomorrow = true;
  }
  if (now >= bukaWhen) {
    const tom = computePrayerTimes(new Date(y, m - 1, d + 1, 12, 0, 0), settings);
    bukaWhen = tom.rows.find((r) => r.key === 'maghrib').when;
    bukaTomorrow = true;
  }
  return {
    tz: today.tz,
    imsak: { ...imsak, when: imsakWhen, timeLabel: formatTime(imsak.when, today.tz), isTomorrow: imsakTomorrow, todayLabel: imsak.timeLabel },
    buka: { ...buka, when: bukaWhen, timeLabel: formatTime(buka.when, today.tz), isTomorrow: bukaTomorrow, todayLabel: buka.timeLabel },
    today
  };
}

export function qiblaFrom(settings = getSettings()) {
  const { lat, lon } = settings.coords;
  let bearing;
  if (typeof adhan !== 'undefined' && adhan.Qibla) {
    bearing = adhan.Qibla(new adhan.Coordinates(lat, lon));
  } else {
    bearing = greatCircleQibla(lat, lon);
  }
  return { bearing, lat, lon, formula: 'great-circle / adhan.Qibla ke Ka‘bah 21.4225°N, 39.8262°E' };
}
