import { BaseSideService } from '../shared/zml-side'

// Protokol pesan kecil: satu hari per paket supaya tidak mengirim JSON sebulan
// sekaligus melalui Bluetooth.

async function get(url) {
  const response = await fetch(url)
  const body = response.body || response
  const data = typeof body === 'string' ? JSON.parse(body) : body
  if (!data || data.status !== true) throw new Error('Respons API tidak valid')
  return data.data
}

let allLocations
const geoCache = {}
function normalize(value) {
  return String(value || '').toUpperCase().replace(/\bKABUPATEN\b/g, 'KAB')
    .replace(/\bKAB\./g, 'KAB').replace(/\bKOTA\b/g, 'KOTA')
    .replace(/[^A-Z0-9]/g, '')
}
async function locationCatalog() {
  if (!allLocations) allLocations = await get('https://api.myquran.com/v3/sholat/kabkota/semua')
  return allLocations
}
async function geo(url) {
  const response = await fetch(url)
  const body = response.body || response
  const json = typeof body === 'string' ? JSON.parse(body) : body
  if (!json || !Array.isArray(json.data)) throw new Error('Daftar wilayah tidak tersedia')
  return json.data
}
function sendList(send, kind, rows) {
  send({type: 'list-begin', kind})
  for (const row of rows) send({type: 'list-item', kind, row})
  send({type: 'list-end', kind})
}

AppSideService(BaseSideService({
  onInit() {
    console.log('[Jadwal Salat] Side Service onInit')
  },
  async onCall(call) {
      if (call.method !== 'prayer.command') return
      const req = call.params
      const send = message => this.call({method: 'prayer.message', params: message})
      try {
        this.log('[Jadwal Salat] menerima pesan dari jam')
        console.log('[Jadwal Salat] perintah:', req.type)
        if (req.type === 'provinces') {
          send({type: 'progress', message: 'Memuat provinsi...'})
          const provinces = await geo('https://equran.id/api/v2/shalat/provinsi')
          sendList(send, 'provinces', provinces.map(name => ({name})))
        } else if (req.type === 'cities') {
          if (!req.province || typeof req.province !== 'string') throw new Error('Provinsi belum dipilih')
          send({type: 'progress', message: 'Memuat kabupaten/kota...'})
          const province = req.province
          const cityNames = geoCache[province] || await (async () => {
            const response = await fetch({
              url: 'https://equran.id/api/v2/shalat/kabkota',
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({provinsi: province})
            })
            const body = response.body || response
            const json = typeof body === 'string' ? JSON.parse(body) : body
            if (!json || !Array.isArray(json.data)) throw new Error('Daftar kota tidak tersedia')
            return json.data
          })()
          geoCache[province] = cityNames
          const catalog = await locationCatalog()
          const lookup = {}
          for (const row of catalog) lookup[normalize(row.lokasi)] = row
          const rows = cityNames.map(name => lookup[normalize(name)]).filter(Boolean)
            .map(row => ({id: row.id, lokasi: row.lokasi, prov: province.toUpperCase()}))
          if (!rows.length) throw new Error('Coba daftar alfabet untuk provinsi ini')
          sendList(send, 'cities', rows)
        } else if (req.type === 'letters') {
          sendList(send, 'letters', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(name => ({name})))
        } else if (req.type === 'letter') {
          if (!/^[A-Z]$/.test(req.letter)) throw new Error('Huruf tidak valid')
          send({type: 'progress', message: 'Memuat wilayah...'})
          const rows = (await locationCatalog()).filter(row =>
            row.lokasi.replace(/^(KAB\.|KOTA)\s+/, '').startsWith(req.letter))
            .map(row => ({id: row.id, lokasi: row.lokasi}))
          sendList(send, 'cities', rows)
        } else if (req.type === 'schedule') {
          send({type: 'progress', message: 'Ponsel mengambil jadwal...'})
          const month = req.month
          if (!/^\d{4}-\d\d$/.test(month) || !/^[a-f0-9]+$/i.test(req.id)) throw new Error('Pilihan tidak valid')
          const result = await get('https://api.myquran.com/v3/sholat/jadwal/' + req.id + '/' + month)
          send({type: 'begin', id: req.id, name: result.kabko, province: result.prov, month})
          const days = result.jadwal || {}
          for (const date of Object.keys(days).sort()) {
            const row = days[date]
            send({type: 'day', date, times: {
              subuh: row.subuh, dzuhur: row.dzuhur, ashar: row.ashar,
              maghrib: row.maghrib, isya: row.isya
            }})
          }
          send({type: 'end', month})
        } else if (req.type === 'hijri') {
          if (!/^\d{4}-\d\d-\d\d$/.test(req.date)) throw new Error('Tanggal tidak valid')
          const result = await get('https://api.myquran.com/v3/cal/hijr/' + req.date)
          const hijri = result.hijr
          if (!hijri || !hijri.day || !hijri.monthName || !hijri.year) throw new Error('Tanggal Hijriah tidak tersedia')
          send({type: 'hijri', date: req.date, label: hijri.day + ' ' + hijri.monthName + ' ' + hijri.year})
        }
      } catch (error) {
        console.log('[Jadwal Salat] gagal:', String(error && error.stack || error))
        try { send({type: 'error', message: String(error.message || error)}) } catch (sendError) { console.log('Balasan gagal:', sendError) }
      }
  },
  onRun() { console.log('[Jadwal Salat] Side Service onRun') }
}))
