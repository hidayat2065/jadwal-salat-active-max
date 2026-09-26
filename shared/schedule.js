export const PRAYERS = [
  ['subuh', 'Subuh'], ['dzuhur', 'Zuhur'], ['ashar', 'Asar'],
  ['maghrib', 'Magrib'], ['isya', 'Isya']
]

// Jadwal API menggunakan zona waktu setempat. Offset eksplisit mencegah zona
// ponsel/jam yang salah menggeser alarm setelah bepergian.
export function offsetForProvince(province) {
  if (/BALI|NUSA TENGGARA BARAT|NUSA TENGGARA TIMUR|SULAWESI|KALIMANTAN SELATAN|KALIMANTAN TIMUR|KALIMANTAN UTARA/.test(province)) return 8
  if (/MALUKU|PAPUA/.test(province)) return 9
  return 7
}

export function prayerTimestamp(date, clock, utcOffset) {
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !/^\d\d:\d\d$/.test(clock)) return NaN
  const [y, m, d] = date.split('-').map(Number)
  const [h, minute] = clock.split(':').map(Number)
  return Date.UTC(y, m - 1, d, h - utcOffset, minute)
}

export function futureEvents(days, utcOffset, now = Date.now()) {
  const events = []
  for (const date of Object.keys(days).sort()) {
    const times = days[date]
    for (const [key, prayer] of PRAYERS) {
      const when = prayerTimestamp(date, times[key], utcOffset)
      if (!Number.isFinite(when)) continue
      if (when - 600000 > now + 2000) events.push({date, prayer, early: true, at: when - 600000})
      if (when > now + 2000) events.push({date, prayer, early: false, at: when})
    }
  }
  return events.sort((a, b) => a.at - b.at)
}
