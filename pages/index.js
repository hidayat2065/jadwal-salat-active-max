import { createWidget, deleteWidget, widget, align, text_style, prop } from '@zos/ui'
import { BasePage } from '../shared/zml-page'
import { LocalStorage } from '@zos/storage'
import { set as setAlarm, cancel as cancelAlarm } from '@zos/alarm'
import { Time } from '@zos/sensor'
import { PRAYERS, futureEvents, offsetForProvince, prayerTimestamp } from '../shared/schedule'

const store = new LocalStorage()
const BLUE = 0x54d4c1
const WHITE = 0xffffff
const MUTED = 0xaab8c5
const DARK = 0x0a1019
const ALERT_LIMIT = 40 // kurang lebih 4 hari; disegarkan saat aplikasi dibuka
let screen = 'home'
let provinces = []
let cities = []
let letters = []
let selectedProvince = ''
let incomingList
let viewWidgets = []
let timeSensor
let countdownWidget
let titleWidget
let nextCountdownEvent
let secondTimer
let active = false
let displayedDay = ''
let state = store.getItem('state', {location: null, days: {}, alarms: [], lastSync: 0})
let incoming = null
let status = ''
let transport = null
function todayAt(offset) {
  return new Date(Date.now() + offset * 3600000).toISOString().slice(0, 10)
}
function monthAt(offset) { return todayAt(offset).slice(0, 7) }
function message(value) {
  if (!transport) { status = 'Menunggu aplikasi...'; draw(); return }
  try { transport.call({method: 'prayer.command', params: value}) }
  catch (error) { status = 'Gagal kirim: ' + error.message; draw() }
}
function text(value, y, size, color = WHITE, height = 40) {
  const item = createWidget(widget.TEXT, {
    x: 28, y, w: 424, h: height, text: value, text_size: size,
    color, align_h: align.CENTER_H, align_v: align.CENTER_V,
    text_style: text_style.ELLIPSIS
  })
  viewWidgets.push(item)
  return item
}
function action(label, y, callback, x = 78, w = 324) {
  const button = createWidget(widget.BUTTON, {
    x, y, w, h: 49, radius: 22, text: label, text_size: 22,
    color: WHITE, normal_color: 0x1d3737, press_color: 0x286454,
    click_func: callback
  })
  viewWidgets.push(button)
}
function clear() {
  for (let i = viewWidgets.length - 1; i >= 0; i--) {
    try { deleteWidget(viewWidgets[i]) } catch (error) { console.log('Jadwal Salat UI delete:', error) }
  }
  viewWidgets = []
  viewWidgets.push(createWidget(widget.FILL_RECT, {x: 0, y: 0, w: 480, h: 480, color: DARK}))
}
function openProvinces() {
  screen = 'provinces'
  status = provinces.length ? '' : 'Memuat provinsi...'
  draw()
  if (!provinces.length) message({type: 'provinces'})
}
function openCities(province) {
  selectedProvince = province
  cities = []
  screen = 'cities'
  status = 'Memuat kabupaten/kota...'
  draw()
  message({type: 'cities', province})
}
function openLetters() {
  screen = 'letters'
  status = letters.length ? '' : 'Memuat daftar alfabet...'
  draw()
  if (!letters.length) message({type: 'letters'})
}
function openLetter(letter) {
  selectedProvince = ''
  cities = []
  screen = 'cities'
  status = 'Memuat wilayah huruf ' + letter + '...'
  draw()
  message({type: 'letter', letter})
}
function scrollRows(rows, onChoose) {
  if (!rows.length) { text(status || 'Belum ada data', 170, 20, MUTED, 80); return }
  const data = rows.map(row => ({label: row.label || row.lokasi || row.name}))
  const list = createWidget(widget.SCROLL_LIST, {
    x: 36, y: 105, w: 408, h: 290, item_space: 7,
    item_config: [{type_id: 1, item_height: 58, item_bg_color: 0x1d3737,
      item_bg_radius: 20, text_view: [{x: 12, y: 5, w: 384, h: 48,
        key: 'label', color: WHITE, text_size: 21, action: true}], text_view_count: 1}],
    item_config_count: 1, data_array: data, data_count: data.length,
    item_click_func: (_, index) => {
      const chosen = rows[index]
      if (chosen) setTimeout(() => onChoose(chosen), 0)
    }, enable_scroll_bar: true
  })
  viewWidgets.push(list)
}
function updateCountdown() {
  if (screen !== 'home' || !countdownWidget || !titleWidget) return
  const offset = state.location ? offsetForProvince(state.location.province) : 7
  if (displayedDay !== todayAt(offset)) { draw(); refreshDay(); return }
  if (!nextCountdownEvent || nextCountdownEvent.at <= Date.now()) {
    nextCountdownEvent = futureEvents(state.days, offset).find(e => !e.early)
  }
  const next = nextCountdownEvent
  const clock = next && (state.days[next.date] || {})[PRAYERS.find(x => x[1] === next.prayer)[0]]
  const seconds = next ? Math.max(0, Math.floor((next.at - Date.now()) / 1000)) : 0
  titleWidget.setProperty(prop.TEXT, next ? next.prayer + ' ' + clock : 'Jadwal belum tersedia')
  countdownWidget.setProperty(prop.TEXT, next
    ? '− ' + String(Math.floor(seconds / 3600)).padStart(2, '0') + ':' + String(Math.floor(seconds % 3600 / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
    : status)
}
function tick() {
  if (!active) return
  try { updateCountdown() } catch (error) { console.log('Jadwal Salat countdown:', error) }
  secondTimer = setTimeout(tick, 1000)
}
function refreshDay() {
  if (!state.location) return
  const offset = offsetForProvince(state.location.province)
  const day = todayAt(offset)
  if (!state.hijri || state.hijri.date !== day) message({type: 'hijri', date: day})
  if (!state.days[day]) message({type: 'schedule', id: state.location.id, month: monthAt(offset)})
  const tomorrow = new Date(Date.now() + offset * 3600000 + 86400000).toISOString().slice(0, 10)
  if (tomorrow.slice(0, 7) !== day.slice(0, 7) && !state.days[tomorrow]) {
    message({type: 'schedule', id: state.location.id, month: tomorrow.slice(0, 7)})
  }
}
function draw() {
  clear()
  if (screen === 'provinces') {
    text('Pilih provinsi', 40, 29, BLUE)
    const recent = (state.recent || []).map(row => ({...row, label: 'Terakhir: ' + row.name}))
    scrollRows([...recent, ...provinces.map(p => ({name: p.name, label: p.name})),
      {name: 'Semua wilayah A-Z', alphabet: true}], row => {
      if (row.id) select({id: row.id, lokasi: row.name, prov: row.province})
      else if (row.alphabet) openLetters()
      else openCities(row.name)
    })
    action('Kembali', 409, () => { screen = 'home'; draw() })
  } else if (screen === 'letters') {
    text('Pilih huruf kota', 40, 29, BLUE)
    scrollRows(letters, row => openLetter(row.name))
    action('Kembali', 409, openProvinces)
  } else if (screen === 'cities') {
    text(selectedProvince || 'Seluruh Indonesia', 40, 26, BLUE)
    scrollRows(cities, select)
    action('Kembali', 409, selectedProvince ? openProvinces : openLetters)
  } else {
    const location = state.location
    const offset = location ? offsetForProvince(location.province) : 7
    const day = todayAt(offset)
    displayedDay = day
    const today = state.days[day] || {}
    const next = futureEvents(state.days, offset).find(e => !e.early)
    nextCountdownEvent = next
    text(location ? location.name : 'Pilih lokasi', 49, 23, BLUE)
    titleWidget = text(next ? next.prayer + ' ' + (state.days[next.date] || {})[PRAYERS.find(x => x[1] === next.prayer)[0]] : 'Jadwal belum tersedia', 104, 39)
    const remaining = next ? Math.max(0, Math.floor((next.at - Date.now()) / 1000)) : 0
    countdownWidget = text(next ? '− ' + String(Math.floor(remaining / 3600)).padStart(2, '0') + ':' + String(Math.floor(remaining % 3600 / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0') : status, 154, 25, MUTED)
    const [year, month, date] = day.split('-')
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(month) - 1]
    const hijri = state.hijri && state.hijri.date === day
      ? state.hijri.label.replace(/Rabiulakhir/gi, 'Rabiul Akhir') : 'Hijriah: --'
    text(Number(date) + ' ' + monthName + ' ' + year + ' · ' + hijri, 195, 18, MUTED)
    PRAYERS.forEach(([key, name], i) => {
      const x = 30 + i * 85
      viewWidgets.push(createWidget(widget.TEXT, {x, y: 261, w: 80, h: 28, text: name, text_size: 17, color: MUTED, align_h: align.CENTER_H}))
      viewWidgets.push(createWidget(widget.TEXT, {x, y: 289, w: 80, h: 29, text: today[key] || '--:--', text_size: 20, color: WHITE, align_h: align.CENTER_H}))
    })
    text(status || (state.lastSync ? 'Data diperbarui ' + new Date(state.lastSync).toISOString().slice(0, 10) : 'Sambungkan ke Zepp'), 328, 18, MUTED)
    action('Ganti lokasi', 373, openProvinces)
  }
}
function scheduleAlarms() {
  for (const id of state.alarms || []) { try { cancelAlarm(id) } catch (_) {} }
  state.alarms = []
  const location = state.location
  if (!location) return
  const offset = offsetForProvince(location.province)
  for (const event of futureEvents(state.days, offset).slice(0, ALERT_LIMIT)) {
    const id = setAlarm({
      url: 'app-service/reminder',
      time: Math.floor(event.at / 1000),
      store: true,
      param: JSON.stringify({prayer: event.prayer, early: event.early, region: location.name})
    })
    if (id) state.alarms.push(id)
  }
  store.setItem('state', state)
}
function cancelOldAlarms(ids) {
  let index = 0
  function batch() {
    for (let count = 0; count < 5 && index < ids.length; count++, index++) {
      try { cancelAlarm(ids[index]) } catch (_) {}
    }
    if (index < ids.length) setTimeout(batch, 0)
  }
  batch()
}
function select(location) {
  if (!location || !location.id) return
  const oldAlarms = state.alarms || []
  state.location = {id: location.id, name: location.lokasi, province: location.prov || 'JAWA BARAT'}
  state.recent = [state.location, ...(state.recent || []).filter(row => row.id !== location.id)].slice(0, 3)
  state.days = {}
  state.hijri = null
  state.alarms = []
  store.setItem('state', state)
  status = 'Mengunduh jadwal...'
  screen = 'home'
  draw()
  cancelOldAlarms(oldAlarms)
  message({type: 'schedule', id: location.id, month: monthAt(offsetForProvince(state.location.province))})
}
function onMessage(msg) {
  try {
    if (msg.type === 'list-begin') {
      incomingList = {kind: msg.kind, rows: []}
      return
    } else if (msg.type === 'list-item' && incomingList && msg.kind === incomingList.kind) {
      incomingList.rows.push(msg.row)
      return
    } else if (msg.type === 'list-end' && incomingList && msg.kind === incomingList.kind) {
      if (msg.kind === 'provinces') provinces = incomingList.rows
      if (msg.kind === 'letters') letters = incomingList.rows
      if (msg.kind === 'cities') cities = incomingList.rows
      status = incomingList.rows.length ? '' : 'Wilayah tidak tersedia'
      incomingList = null
    } else if (msg.type === 'progress') {
      status = msg.message
      if (screen !== 'home') return
    } else if (msg.type === 'begin') {
      incoming = {id: msg.id, days: {}, name: msg.name, province: msg.province}
      return
    } else if (msg.type === 'day' && incoming) {
      incoming.days[msg.date] = msg.times
    } else if (msg.type === 'end' && incoming && state.location && incoming.id === state.location.id) {
      state.location.name = incoming.name
      state.location.province = incoming.province
      state.days = {...state.days, ...incoming.days}
      state.lastSync = Date.now()
      incoming = null
      scheduleAlarms()
      status = 'Pengingat aktif'
      refreshDay()
    } else if (msg.type === 'hijri' && msg.date === todayAt(state.location ? offsetForProvince(state.location.province) : 7)) {
      state.hijri = {date: msg.date, label: msg.label.replace(/Rabiulakhir/gi, 'Rabiul Akhir')}
      store.setItem('state', state)
    } else if (msg.type === 'error') status = 'Gagal: ' + msg.message
    draw()
  } catch (error) { status = 'Balasan rusak: ' + error.message; draw() }
}

Page(BasePage({
  build() {
    transport = this
    active = true
    try {
      draw()
      secondTimer = setTimeout(tick, 1000)
      timeSensor = new Time()
      timeSensor.onPerMinute(() => {
        try {
          refreshDay()
        } catch (error) { console.log('Jadwal Salat minute:', error) }
      })
      if (state.location) {
        const offset = offsetForProvince(state.location.province)
        if (!state.hijri || state.hijri.date !== todayAt(offset)) message({type: 'hijri', date: todayAt(offset)})
        if (!state.days[todayAt(offset)] || Date.now() - state.lastSync > 86400000) {
          message({type: 'schedule', id: state.location.id, month: monthAt(offset)})
        }
      }
    } catch (error) {
      console.log('Jadwal Salat build:', error)
      createWidget(widget.FILL_RECT, {x: 0, y: 0, w: 480, h: 480, color: DARK})
      createWidget(widget.TEXT, {x: 40, y: 180, w: 400, h: 120, text: 'Gagal membuka: ' + String(error.message || error), text_size: 19, color: WHITE, align_h: align.CENTER_H})
    }
  },
  onCall(req) { if (req.method === 'prayer.message') onMessage(req.params) },
  onDestroy() { active = false; if (secondTimer) clearTimeout(secondTimer); transport = null }
}))
