# Wake on LAN

[![CI](https://github.com/SyamStud/Wake-on-Lan/actions/workflows/ci.yml/badge.svg)](https://github.com/SyamStud/Wake-on-Lan/actions/workflows/ci.yml)

A self-hosted web app to **power on PCs remotely via Wake-on-LAN** magic packets and **shut them down over SSH** (`sudo shutdown -h now`). Includes device management, password-protected login, online/offline monitoring, and scheduled on/off.

## Features

### Main Features

- **Wake-on-LAN**: power on PCs remotely with a UDP broadcast magic packet (default port 9, 3 retries)
- **SSH shutdown**: power off PCs over SSH (`sudo shutdown -h now`, passwordless sudo or piped password)

### Additional Features

- Device management: create, edit, delete, duplicate-MAC protection
- Online/offline status via TCP probe to the SSH port (refreshes every 15s)
- Scheduled power on/off per device (timezone-aware, e.g. `TZ=Asia/Jakarta`)
- **Docker container management**: list containers on any device via SSH and start / stop / restart them from the web UI
- **Activity log**: history of wakes, shutdowns, logins, terminal sessions, and status changes
- **Uptime sparkline**: 24h online/offline chart per device on the dashboard
- **API key**: automation access without browser login (`Authorization: Bearer <key>`)
- **Dark mode**: toggleable theme, persisted per browser
- **Web terminal**: interactive SSH shell for any device with SSH configured (xterm.js + WebSocket)
- **Remote desktop**: full VNC desktop session in the browser (noVNC + SSH tunnel) for devices running a VNC server — with a one-click **"Aktifkan Remote"** button that installs and configures x11vnc on the target automatically via SSH
- LAN scanner with cached results (best run on the host, see [Docker notes](#docker))
- Password login with signed session cookies (bcrypt + HMAC)
- Indonesian UI, no frontend framework required beyond React + Vite

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, Express, better-sqlite3, ssh2 |
| Frontend | React 18, Vite, React Router |
| Storage | SQLite (WAL mode), persisted under `backend/data/` |
| Deployment | Docker + docker compose (multi-stage build) |
| CI | GitHub Actions — backend tests, frontend build, secret scan |

## Project Structure

```
wake-on-lan/
├── backend/            # Express server (entry: src/index.js)
│   ├── src/            # app, routes, device-store, actions, scheduler, scan-job, ssh, wol
│   ├── test/           # Node test runner suites
│   └── public/dist/    # Frontend build output (gitignored)
├── frontend/           # React + Vite UI
├── docker-compose.yml  # Container orchestration
└── .github/workflows/  # CI pipeline
```

## Getting Started

### Local development

Requirements: Node.js >= 18

```bash
# 1. Install and configure the backend
cd backend
npm install
cp .env.example .env      # then set SESSION_SECRET & APP_PASSWORD

# 2. Build the frontend (outputs to backend/public/dist)
cd ../frontend
npm install
npm run build

# 3. Run the server
cd ../backend
npm start
```

Open `http://localhost:3000`. The admin password is either `APP_PASSWORD` from `.env` or a randomly generated one printed to the console on first start.

> Frontend development: `cd frontend && npm run dev` (add a Vite proxy to the API for hot reload). After changing frontend code, run `npm run build` and restart the server.

### Docker

```bash
docker compose up -d
```

- Frontend is built inside the image (multi-stage build) — no local setup needed.
- Port `3000` is published; open `http://localhost:3000` from any browser on the host.
- The SQLite database persists in `backend/data/` via bind mount — existing devices and settings carry over.
- For SSH-key auth, drop keys in the `keys/` folder and use `/keys/<name>` as the key path in the device form.
- Configuration comes from `backend/.env` (`PORT`, `SESSION_SECRET`, `APP_PASSWORD`); adjust `TZ` in the compose file for schedule timezones.
- Verified on Docker Desktop + WSL2 (mirrored mode): WoL UDP broadcast reaches the LAN, TCP to LAN hosts works, healthcheck is active.
- **Known limitation:** the Scan page is not fully functional inside a container — the container only sees the Docker bridge interface (wrong subnet, empty ARP/MAC resolution). Previously cached scan results still display. To scan your LAN, run the backend directly on the host (`cd backend && npm start`) or use Docker on a plain Linux host with `network_mode: host`.
- If an old `node server.js` process is still running on the host, it will conflict on port 3000 — stop it first (`pkill -f "node server.js"`).

### Windows with WSL

Do not run `npm start` directly from a PowerShell session inside a UNC path (`\\wsl.localhost\...`) — Windows Node cannot run from UNC paths and `better-sqlite3` is built for Linux.

Run the server inside WSL:

```powershell
wsl -d Ubuntu -- bash -c "cd /home/lenovo/Projects/wake-on-lan/backend && npm start"
```

The Windows browser can then open `http://localhost:3000` (WSL2 forwards the port automatically).

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PORT` | Web server port | `3000` |
| `SESSION_SECRET` | Key used to sign session cookies — set a long random value | random per start |
| `APP_PASSWORD` | Fixed admin password. If empty, a random one is generated on first run | — |
| `TZ` | Timezone for the scheduler (set in compose) | `Asia/Jakarta` |

## Target PC Setup (SSH Shutdown)

1. Enable the SSH server on the target:

   ```bash
   sudo systemctl enable --now ssh        # Debian/Ubuntu
   # or: sudo systemctl enable --now sshd # Fedora/Arch
   ```

2. Allow the WoL server to log in without a password (recommended). On the WoL server:

   ```bash
   ssh-keygen -t ed25519                  # if you don't have a key yet
   ssh-copy-id user@target-ip
   ```

3. Allow passwordless `shutdown` (required for `sudo -n shutdown -h now`). On the target:

   ```bash
   sudo visudo -f /etc/sudoers.d/shutdown
   ```

   Add the following line (replace `user` with the target username):

   ```
   user ALL=(ALL) NOPASSWD: /usr/sbin/shutdown
   ```

   > Alternative: use password auth from the device form (the server pipes the password via `sudo -S`), but the SSH password is then stored in plain text in the local database — less secure.

4. Make sure the target's MAC address is correct and Wake-on-LAN is enabled in the BIOS (Enable Wake-on-LAN / Power On By PCI-E) and in the OS:

   ```bash
   sudo ethtool -s eth0 wol g
   ```

   To persist it, set `WakeOnLan g` in `/etc/network/interfaces`, netplan, or NetworkManager.

### Remote Desktop (Linux target)

The web app tunnels to a VNC server on the target through SSH — no open firewall ports needed, only SSH access (which the shutdown feature already requires).

**Cara paling mudah**: Devices → ⋮ → **Remote** → klik **"Aktifkan Remote"** (PC dengan monitor) atau **"Mode Headless"** (PC tanpa monitor — virtual desktop Xvfb + XFCE). Aplikasi otomatis:
1. SSH ke target, install `x11vnc` (+ `xvfb`/`xfce4` untuk headless) jika belum ada
2. Buat & nyalakan service `x11vnc` (systemd), atau jalankan langsung jika bukan systemd
3. Verifikasi port 5900, lalu browser langsung terhubung

Setelan manual (opsional):

```bash
sudo apt install x11vnc
x11vnc -display :0 -auth guess -forever -shared -passwd 'password-vnc'
```

(or `-nopw` for no password on a trusted LAN; the browser will ask for the VNC password if set)

Catatan: untuk PC **tanpa monitor**, pakai tombol **"Mode Headless"** — aplikasi membuat virtual desktop (Xvfb + XFCE) di display terpisah sehingga selalu ada gambar. Jika SSH target menonaktifkan forwarding (`AllowTcpForwarding no`), aktifkan di `/etc/ssh/sshd_config`.

## Adding a Device

| Field | Description |
|---|---|
| Name | Device label |
| MAC Address | Format `AA:BB:CC:DD:EE:FF` |
| Broadcast | Subnet broadcast of the PC, e.g. `192.168.1.255`; use `255.255.255.255` if unsure |
| WoL Port | Usually 9 (or 7) |
| SSH Host / IP | Target PC IP used for shutdown |
| Username | SSH user on the target |
| Auth Method | `SSH Key` (key path, recommended) or `Password` |
| Key Path | E.g. `/home/user/.ssh/id_ed25519` (a key owned by the user running the server) |

> `ssh_password` is never returned by the API. When editing a device without entering a new password, the existing one is kept.

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/login` | Login `{ password }` |
| POST | `/api/logout` | Logout |
| GET | `/api/me` | Check session |
| GET | `/api/devices` | List devices |
| POST | `/api/devices` | Create device |
| PUT | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Delete device |
| POST | `/api/devices/:id/wake` | Send magic packet |
| POST | `/api/devices/:id/shutdown` | Shutdown via SSH |
| GET | `/api/devices/:id/containers` | List Docker containers on the target via SSH |
| POST | `/api/devices/:id/containers/:name/:action` | `start` / `stop` / `restart` a container via SSH |
| POST | `/api/devices/:id/remote-setup` | Auto-install & start VNC on the target via SSH |
| GET | `/api/devices/:id/status` | Online/offline status |
| GET | `/api/devices/:id/history?hours=24` | Status samples for uptime chart (auto-aggregates for long ranges) |
| GET | `/api/activity?limit=&offset=` | Activity log (newest first) |
| GET | `/api/settings/api-key` | API key status (active or not) |
| POST | `/api/settings/api-key` | Generate a new API key (revokes the old one) |
| DELETE | `/api/settings/api-key` | Revoke the API key |
| WS | `/api/terminal?deviceId=:id` | Interactive SSH terminal (requires session cookie) |
| WS | `/api/remote?deviceId=:id&port=5900` | TCP tunnel through SSH for remote desktop / any service |
| GET | `/api/devices/wake-count` | Total wake actions |
| GET | `/api/scan/cache` | Cached scan results |
| POST | `/api/scan/start` | Start a LAN scan |
| POST | `/api/scan/stop` | Stop a running scan |
| GET | `/api/scan/status` | Scan progress |

All device endpoints require a valid session cookie or `Authorization: Bearer <api-key>`.

## Testing

```bash
cd backend
npm test
```

Runs the Node test runner suites (device store, actions, scan job, WoL). CI runs the same tests plus a frontend build and a secret scan that fails the pipeline if credentials are committed.

## Security Notes

- SSH passwords are stored in plain text in `backend/data/wol.db` — prefer SSH-key auth.
- The server does not require root; shutdown is executed via SSH as the target user.
- Magic packets can only wake PCs with WoL enabled that are reachable from the server's broadcast domain.
- Use on a trusted network. For internet access, put a TLS reverse proxy (e.g. Caddy) in front — do not expose it directly.
- Login is rate-limited (10 failed attempts lock the source for 15 minutes).
- Never commit `backend/.env` or `backend/data/` — they are gitignored, and CI enforces it.
