# CatatAi ⚡ — Pencatatan Keuangan & Scan Nota Berbasis AI

Aplikasi web modern berbasis SvelteKit 3 untuk mencatat transaksi keuangan (pengeluaran & pemasukan/gaji) secara santai via percakapan chat seperti WhatsApp atau scan foto struk/nota belanja menggunakan AI Vision DeepSeek. Dilengkapi fitur multi-user authentication (registrasi & login terisolasi), rekap dashboard interaktif, ekspor CSV, dan dukungan Progressive Web App (PWA).

---

## ✨ Fitur Utama

1. **Percakapan Asisten WhatsApp-Style:**
   - Cukup ketik alami: *"beli kopi 18k"*, *"makan siang padang 35rb bayar qris"*, *"gaji masuk 10juta transfer bca"*.
   - Konfirmasi cepat dengan tombol atau respons chat: *"ya"*, *"betul"*, *"simpan"*.
2. **Scan Nota & Struk (DeepSeek Vision):**
   - Lampirkan foto struk/nota belanja langsung dari kamera atau galeri untuk ekstraksi otomatis toko, item, nominal, dan pajak.
3. **Multi-User & Isolasi Data Penuh:**
   - Fitur Registrasi & Login dengan password hashing Scrypt aman dan sesi cookie HTTP-Only.
   - Data transaksi dan rekap setiap akun terisolasi 100% dan tidak pernah bercampur dengan akun lain.
4. **Header Modern & Antarmuka Warm Paper:**
   - Desain mobile-first dengan tema hangat (*cozy linen & paper*), doodle wallpaper WhatsApp, dan ikon vektor estetik (SVG).
   - Header 2-tier yang rapi tanpa tumpang tindih elemen (*zero overlap*).
5. **PWA (Progressive Web App):**
   - Dapat diinstal langsung ke homescreen Android / iOS / Desktop seperti aplikasi native via manifest & service worker.
6. **Dashboard & Rekap Real-Time:**
   - Filter bulanan, rekap harian, tren pengeluaran, distribusi kategori, top merchant, dan ekspor CSV.

---

## 🚀 Panduan Deploy Mudah di Vercel

Proyek ini telah dikonfigurasi menggunakan `@sveltejs/adapter-vercel` (Node.js 22.x) dan `vercel.json` sehingga dapat langsung dideploy ke Vercel tanpa konfigurasi rumit.

### Langkah-langkah Deploy:

1. **Push repository ke GitHub / GitLab / Bitbucket**.
2. Buka dashboard [Vercel](https://vercel.com/) dan pilih **Add New Project**.
3. Import repository **CatatAi**.
4. Di bagian **Environment Variables**, tambahkan variabel berikut:
   - `DATABASE_URL` = URL koneksi Neon PostgreSQL Anda (misal: `postgres://neondb_owner:***@***.neon.tech/neondb?sslmode=require`)
   - `DEEPSEEK_API_KEY` = API Key DeepSeek Anda (`sk-***`)
   - `DEEPSEEK_MODEL` = `deepseek-flash` *(opsional, default: deepseek-flash)*
   - `DEEPSEEK_VISION_MODEL` = `deepseek-flash` *(opsional, default: deepseek-flash)*
5. Klik **Deploy**. Vercel akan otomatis mendeteksi SvelteKit dan menghasilkan Serverless Function & Edge static assets secara otomatis!

---

## 💻 Menjalankan Secara Lokal

```bash
# 1. Masuk ke direktori
cd CatatAi

# 2. Salin template env dan sesuaikan
cp .env.example .env

# 3. Install dependensi
npm install

# 4. Jalankan dev server
npm run dev
```

Buka `http://localhost:5173` di browser Anda.
