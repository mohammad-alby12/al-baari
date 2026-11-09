# Kelas 6 Al Baari

Portal kelas full-stack: Node.js + Express + SQLite, UI responsif, tanpa notifikasi.

## Fitur
- Dashboard kelas dengan ringkasan PR dan jadwal hari ini.
- Jadwal Senin–Sabtu yang dapat dikelola.
- PR/tugas: tambah, hapus, tandai selesai.
- Papan pengumuman kelas.
- Tiga mini game: Memory Matrix, Quiz Sprint, Focus 60.
- Panel pengelola dengan PIN.
- Nama portal, motto, tahun ajaran, dan nama developer dapat diedit.
- Database SQLite tersimpan lokal di VPS.

## Jalankan lokal
Butuh Node.js 20 atau lebih baru.

```bash
npm install
cp .env.example .env
# Edit ADMIN_PIN di .env
npm start
```
Buka `http://localhost:3000`.

PIN awal hanya untuk percobaan: `246810`. Ganti sebelum dipakai sungguhan.

## Deploy ke VPS Hostinger (Ubuntu)
1. Hubungkan SSH ke VPS.
2. Pasang Node.js 20+ dan Git bila belum ada.
3. Upload/extract folder project ke `/var/www/kelas6-albaari`.
4. Jalankan:
   ```bash
   cd /var/www/kelas6-albaari
   npm install
   cp .env.example .env
   nano .env
   ```
5. Isi `ADMIN_PIN` dengan PIN unik yang kuat.
6. Jalankan `npm start` untuk tes.
7. Untuk selalu hidup, gunakan PM2:
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name kelas6-albaari
   pm2 save
   pm2 startup
   ```
8. Pasang Nginx sebagai reverse proxy ke `127.0.0.1:3000`, lalu aktifkan HTTPS menggunakan Certbot.

Contoh server block Nginx:

```nginx
server {
    listen 80;
    server_name kelas.domainkamu.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Catatan penting
- Jadwal awal adalah contoh starter, bukan jadwal resmi sekolah. Perbarui melalui Panel Pengelola.
- PR awal kosong; masukkan tugas sebenarnya melalui Panel Pengelola.
- Database `kelas6.db` dibuat otomatis. Backup file ini secara berkala.
- Untuk keamanan produksi, gunakan HTTPS dan PIN admin yang kuat. Batasi akses panel kepada pengelola kelas.
- Tidak ada push notification, email notification, atau layanan berbayar.
