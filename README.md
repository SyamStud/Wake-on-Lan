# Web Wake-on-LAN + Shutdown via SSH

Web app untuk menyalakan PC dari jarak jauh dengan magic packet (Wake-on-LAN) dan mematikannya lewat SSH (`sudo shutdown -h now`). Dilengkapi manajemen device, login password, dan indikator status online/offline.

## Fitur

- Login password (session cookie, bcrypt)
- Manajemen device: tambah, edit, hapus
- Nyalakan PC: kirim magic packet UDP broadcast (default port 9, 3x pengiriman)
- Matikan PC: SSH ke target lalu `sudo shutdown -h now`
- Status online/offline via probe TCP ke port SSH (refresh tiap 15 detik)
- UI bahasa Indonesia, tanpa framework frontend

## Prasyarat (server)

- Node.js >= 18

## Setup

```bash
cd backend && npm install
cd ../frontend && npm install && npm run build   # build frontend React (ke backend/public/dist)
cd .. && cp backend/.env.example backend/.env   # lalu isi SESSION_SECRET & APP_PASSWORD
cd backend && npm start
```

Buka `http://localhost:3000` (atau alamat LAN server). Password pertama kali:
- dari `APP_PASSWORD` di `.env`, atau
- digenerate acak dan dicetak di console saat pertama kali dijalankan.

### Menjalankan dengan Docker (Linux / Docker Desktop WSL2)

```bash
docker compose up -d
```

- Frontend di-build otomatis di dalam image (multi-stage build), tidak perlu install apa pun.
- Port `3000` di-publish — buka `http://localhost:3000` dari browser Windows maupun WSL.
- Database tersimpan di `backend/data/` (bind mount) — device & password yang sudah ada ikut terpakai.
- Untuk auth SSH key device: taruh key di folder `keys/`, lalu isi Path Key dengan `/keys/<nama-key>`.
- Konfigurasi diambil dari `backend/.env` (PORT, SESSION_SECRET, APP_PASSWORD). Ubah `TZ` di compose untuk zona waktu jadwal.
- Terverifikasi pada Docker Desktop + WSL2 (mode mirrored): UDP broadcast WoL tembus ke LAN, TCP ke LAN jalan, healthcheck aktif.
- **Keterbatasan**: halaman Scan tidak berfungsi penuh di dalam container — container hanya melihat interface bridge Docker (bukan LAN), jadi subnet yang di-scan salah dan resolusi MAC (tabel ARP) kosong. Scan cache lama tetap tampil. Untuk scan subnet LAN, jalankan backend langsung di host (`cd backend && npm start`) atau gunakan Docker di mesin Linux biasa dengan `network_mode: host`.
- Catatan: jika proses `node server.js` lama masih berjalan di host, port 3000 bertabrakan — hentikan dulu (`pkill -f "node server.js"`).

> Frontend memakai React + React Router (halaman `/dashboard`, `/devices`, `/scan`).
> Setelah mengubah kode di `frontend/`, jalankan `cd frontend && npm run build`
> lalu restart server. Untuk development: `cd frontend && npm run dev`
> (proxy API perlu ditambahkan di vite.config.js).

### Menjalankan dari Windows (folder proyek di WSL)

Jangan jalankan `npm start` langsung dari PowerShell yang berada di path UNC
(`\\wsl.localhost\...`) — Node Windows tidak bisa berjalan dari UNC path dan
module native (`better-sqlite3`) sudah di-build untuk Linux.

Jalankan server di dalam WSL:

```powershell
# dari PowerShell mana pun:
wsl -d Ubuntu -- bash -c "cd /home/lenovo/Projects/wake-on-lan/backend && npm start"
```

Browser Windows bisa membuka `http://localhost:3000` (WSL2 otomatis meneruskan
port ke localhost Windows).

## Setup PC target (agar bisa dimatikan via SSH)

1. Aktifkan SSH server di PC target:

   ```bash
   sudo systemctl enable --now ssh        # Debian/Ubuntu
   # atau: sudo systemctl enable --now sshd  # Fedora/Arch
   ```

2. Biarkan server WoL login tanpa password (direkomendasikan). Di server WoL:

   ```bash
   ssh-keygen -t ed25519                 # jika belum punya key
   ssh-copy-id user@ip-pc-target
   ```

3. Izinkan `shutdown` tanpa password sudo (wajib untuk `sudo -n shutdown -h now`). Di PC target:

   ```bash
   sudo visudo -f /etc/sudoers.d/shutdown
   ```

   Isi dengan (ganti `user` dengan username target):

   ```
   user ALL=(ALL) NOPASSWD: /usr/sbin/shutdown
   ```

   > Alternatif: bisa juga pakai auth **password** dari form device (server memakai `sudo -S` dengan pipa password), tapi kurang aman karena password SSH tersimpan plain di database lokal.

4. Pastikan MAC address PC target benar dan WoL aktif di BIOS (Enable Wake-on-LAN / Power On By PCI-E), dan di OS:

   ```bash
   sudo ethtool -s eth0 wol g
   ```

   (untuk persist, set `WakeOnLan g` di `/etc/network/interfaces` atau `netplan` / NetworkManager).

## Menambahkan device di UI

Isi form:

| Field | Keterangan |
|---|---|
| Nama | Label device |
| MAC Address | Format `AA:BB:CC:DD:EE:FF` |
| Broadcast | Broadcast subnet tempat PC berada (cth `192.168.1.255`). Gunakan `255.255.255.255` jika ragu. |
| Port WoL | Biasanya 9 (atau 7) |
| Host / IP SSH | IP PC target untuk shutdown |
| Username | User SSH di PC target |
| Metode Auth | `SSH Key` (path key, disarankan) atau `Password` |
| Path Key | Contoh `/home/user/.ssh/id_ed25519` (key milik user yang menjalankan server) |

Catatan: field `ssh_password` tidak pernah dikembalikan oleh API (lihat catatan di bawah untuk detail; sebenarnya dikirim kembali — jaga keamanan LAN). Untuk auth password, jika device diedit tanpa mengisi password, password lama dipertahankan.

## API

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/login` | Login `{ password }` |
| POST | `/api/logout` | Logout |
| GET | `/api/me` | Cek sesi |
| GET | `/api/devices` | Daftar device |
| POST | `/api/devices` | Tambah device |
| PUT | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Hapus device |
| POST | `/api/devices/:id/wake` | Kirim magic packet |
| POST | `/api/devices/:id/shutdown` | SSH shutdown |
| GET | `/api/devices/:id/status` | Status online/offline |

## Test

```bash
npm test
```

## Keamanan / batasan

- Password SSH tersimpan plain di `backend/data/wol.db` — direkomendasikan pakai SSH key auth.
- Server tidak butuh root; shutdown dilakukan via SSH sebagai user target.
- Magic packet hanya bisa menyalakan PC yang WoL-nya aktif dan berada di subnet yang bisa dijangkau broadcast dari server.
- Gunakan dalam jaringan yang dipercaya. Untuk akses dari internet, pasang reverse proxy dengan TLS (mis. Caddy) — jangan expose langsung.
