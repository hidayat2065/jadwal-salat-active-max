import { createWidget, widget, align, prop } from '@zos/ui'
import { LocalStorage } from '@zos/storage'
import { push } from '@zos/router'
import { PRAYERS, futureEvents, offsetForProvince } from '../shared/schedule'

const BLUE = 0x54d4c1
const WHITE = 0xffffff
const MUTED = 0xaab8c5
let active = false
let refreshTimer
let locationText
let nextText
let dateText
let rows = []

function label(value, y, size, color = WHITE) {
  return createWidget(widget.TEXT, {
    x: 32, y, w: 416, h: 42, text: value, text_size: size, color,
    align_h: align.CENTER_H, align_v: align.CENTER_V
  })
}
function update() {
  // LocalStorage menyimpan snapshot di dalam setiap instance. Buat instance
  // baru agar widget membaca penulisan terbaru dari halaman aplikasi.
  const state = new LocalStorage().getItem('state', {location: null, days: {}})
  const offset = state.location ? offsetForProvince(state.location.province) : 7
  const date = new Date(Date.now() + offset * 3600000).toISOString().slice(0, 10)
  const times = state.days[date] || {}
  const next = futureEvents(state.days, offset).find(event => !event.early)
  const clock = next && (state.days[next.date] || {})[PRAYERS.find(p => p[1] === next.prayer)[0]]
  locationText.setProperty(prop.TEXT, state.location ? state.location.name : 'Pilih lokasi di aplikasi')
  nextText.setProperty(prop.TEXT, next ? next.prayer + '  ' + clock : 'Jadwal belum tersedia')
  const [year, month, day] = date.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const hijri = state.hijri && state.hijri.date === date
    ? state.hijri.label.replace(/Rabiulakhir/gi, 'Rabiul Akhir') : 'Hijriah: --'
  dateText.setProperty(prop.TEXT, Number(day) + ' ' + names[Number(month) - 1] + ' ' + year + ' · ' + hijri)
  rows.forEach((row, index) => row.setProperty(prop.TEXT, PRAYERS[index][1] + '  ' + (times[PRAYERS[index][0]] || '--:--')))
}
function tick() {
  if (!active) return
  try { update() } catch (error) { console.log('Jadwal Salat widget:', error) }
  refreshTimer = setTimeout(tick, 60000)
}

SecondaryWidget({
  build() {
    try {
      createWidget(widget.FILL_RECT, {x: 0, y: 0, w: 480, h: 480, color: 0x0a1019})
      label('JADWAL SALAT', 45, 22, BLUE)
      locationText = label('', 90, 22, BLUE)
      nextText = label('', 142, 37)
      dateText = label('', 187, 17, MUTED)
      rows = PRAYERS.map((_, index) => label('', 231 + index * 31, 20))
      createWidget(widget.BUTTON, {x: 98, y: 402, w: 284, h: 48,
        radius: 22, text: 'Buka aplikasi', text_size: 20,
        color: WHITE, normal_color: 0x1d3737, press_color: 0x286454,
        click_func: () => push({url: 'pages/index'})})
      update()
    } catch (error) { console.log('Jadwal Salat widget build:', error) }
  },
  onResume() { active = true; if (refreshTimer) clearTimeout(refreshTimer); tick() },
  onPause() { active = false; if (refreshTimer) clearTimeout(refreshTimer) },
  onDestroy() { active = false; if (refreshTimer) clearTimeout(refreshTimer) }
})
