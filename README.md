# Jadwal Salat — Amazfit Active Max

Prototipe Zepp OS 5 / API level 4.2. Aplikasi jam menampilkan lima waktu salat,
salat berikutnya, hitung mundur, lokasi aktif, serta notifikasi getar 10 menit
sebelum dan tepat waktu. Data diunduh melalui layanan pendamping di aplikasi Zepp
dari API MyQuran v3 (layanan pihak ketiga yang menyebut Kemenag sebagai sumber).

## Menjalankan

1. `app.appId` sudah diisi dengan ID 1128630 dari konsol pengembang Anda.
   Jika menggunakan akun atau aplikasi lain, ganti dengan ID milik aplikasi itu.
2. Pasang Zeus CLI: `npm install -g @zeppos/zeus-cli`.
   Pastikan `package.json` dan `assets/active-max/icon.png` ikut diekstrak;
   Zeus membutuhkan ikon yang disebut dalam `app.json` ketika membangun paket.
3. Dari direktori proyek jalankan `npm install`, lalu `zeus build`.
   Salinan kode ZML yang dipakai jam dan Side Service disertakan di `shared/`
   agar Zeus memaketkannya sebagai kode aplikasi, bukan nama API perangkat.
   Untuk instalasi uji di jam gunakan
   `zeus preview` dan pindai QR melalui mode pengembang Zepp.
   Berkas `widget-preview_id-ID.png` disertakan karena Zeus memerlukan
   preview widget sesuai `defaultLanguage` aplikasi.
4. Hubungkan Active Max dengan Zepp. Pilih **Ganti lokasi → provinsi →
   kabupaten/kota** di jam, lalu gulir dan ketuk wilayah. Pilihan terakhir
   ditaruh di atas. Gunakan **Semua wilayah A-Z** bila suatu wilayah belum
   tercantum di daftar provinsi. “Kab. Bandung” dan “Kota Bandung” berbeda.
5. Tambahkan widget lewat pengaturan widget jam (biasanya tekan lama tampilan
   jam, lalu ubah daftar widget). Widget membaca jadwal tersimpan; pilih lokasi
   dan unduh jadwal terlebih dahulu melalui aplikasi utama.

## Batas versi awal yang harus diuji sebelum diandalkan

- Komunikasi memakai ZML untuk pembingkaian protokol BLE. Pengiriman 31 paket
  harian, daftar wilayah yang dikirim per item, perilaku notifikasi saat DND,
  serta batas jumlah alarm sistem perlu diuji di jam.
- Hanya sekitar 40 alarm mendatang dipasang per pembaruan. Buka aplikasi sekurangnya
  setiap 2–3 hari untuk menyegarkan alarm, terutama sebelum bepergian.
- Tanggal Hijriah memakai konversi kalender MyQuran dan dapat berbeda dari
  keputusan rukyat resmi. Jika API belum membalas, tampil “--”.
- Hitung mundur diperbarui setiap detik selama layar aplikasi terbuka. Ketika
  aplikasi ditutup, hitung mundur tidak ditampilkan di tampilan jam.
- Widget membuka ulang penyimpanan jadwal saat ditampilkan dan paling sering
  setiap menit setelah itu. Tanggal Hijriah mengikuti data yang telah diterima
  aplikasi. Widget tidak memanggil jaringan atau menjalankan hitung mundur detik.
- Waktu dari API MyQuran perlu dibandingkan dengan Bimas Islam untuk beberapa
  wilayah dan hari. API bukan layanan resmi Kemenag.
- Jam harus terhubung ke ponsel saat pertama memilih kota atau memperbarui data.
  Alarm yang sudah tersimpan dapat tetap berjalan setelah reboot berkat
  `store: true` pada Alarm API, dengan catatan perilaku perangkat perlu diuji.
- Saat pindah ke wilayah WITA/WIT, zona waktu diambil dari provinsi data API.
  Daftar provinsi dan pengelompokan kota dari EQuran.id, sedangkan ID wilayah
  dan jadwal tetap dari MyQuran. Kedua daftar bisa berbeda; jalur **Semua
  wilayah A-Z** menampilkan seluruh lokasi MyQuran. Pembukaan daftar baru
  membutuhkan Zepp di ponsel dan internet. Daftar hanya diminta saat dipilih.

## Berkas

- `pages/index.js`: layar jam, penyimpanan, pembatalan dan pemasangan alarm.
- `app-side/index.js`: pencarian wilayah dan jadwal bulanan MyQuran.
- `secondary-widget/index.js`: widget jadwal dari penyimpanan lokal jam.
- `app-service/reminder.js`: notifikasi saat alarm terpicu.
- `shared/schedule.js`: konversi tanggal dan pembuatan dua event per salat.
- `shared/zml-*.js`: ZML dari Zepp Health versi 0.0.43 (Apache 2.0).
  Lisensi tersimpan di `shared/ZML-LICENSE.txt`.
