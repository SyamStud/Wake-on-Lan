import fs from 'node:fs'
import { Client } from 'ssh2'

export function buildVncSetupScript() {
  return `#!/bin/bash
set -u
if ! command -v x11vnc >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y >/dev/null 2>&1
    apt-get install -y x11vnc >/dev/null 2>&1
  elif command -v apk >/dev/null 2>&1; then
    apk add x11vnc >/dev/null 2>&1
  fi
fi
if ! command -v x11vnc >/dev/null 2>&1; then
  echo "INSTALL_FAIL: x11vnc tidak bisa diinstall"
  exit 1
fi
if command -v systemctl >/dev/null 2>&1; then
  mkdir -p /etc/systemd/system
  cat > /etc/systemd/system/x11vnc.service <<'EOF'
[Unit]
Description=x11vnc VNC server
After=display-manager.service network.target

[Service]
Type=simple
ExecStart=/bin/sh -c "x11vnc -display :0 -auth guess -forever -shared -nopw -noxdamage -nowf -noscr -nodpms >/var/log/x11vnc.log 2>&1"
Restart=always

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable x11vnc >/dev/null 2>&1
  systemctl restart x11vnc
else
  pkill -f x11vnc 2>/dev/null
  sleep 1
  nohup x11vnc -display :0 -auth guess -forever -shared -nopw -noxdamage -nowf -noscr -nodpms >/var/log/x11vnc.log 2>&1 &
  sleep 3
  if ! ss -tln 2>/dev/null | grep -q ':5900' && ! netstat -tln 2>/dev/null | grep -q ':5900'; then
    pkill -f x11vnc 2>/dev/null
    sleep 1
    nohup x11vnc -display :0 -forever -shared -nopw -noxdamage -nowf -noscr -nodpms >/var/log/x11vnc.log 2>&1 &
    sleep 3
  fi
fi
sleep 1
if ss -tln 2>/dev/null | grep -q ':5900' || netstat -tln 2>/dev/null | grep -q ':5900'; then
  echo "VNC_READY"
else
  echo "VNC_FAIL"
  tail -15 /var/log/x11vnc.log 2>/dev/null
fi
`
}

export function setupVncOnTarget(device, clientClass = Client, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const config = {
      host: device.ssh_host,
      port: device.ssh_port || 22,
      username: device.ssh_user,
      readyTimeout: 10000,
    }
    if (device.ssh_auth === 'password' && device.ssh_password) {
      config.password = device.ssh_password
    } else if (device.ssh_key_path) {
      try {
        config.privateKey = fs.readFileSync(device.ssh_key_path)
      } catch (err) {
        return resolve({ ok: false, output: `Tidak bisa membaca SSH key: ${err.message}` })
      }
    } else {
      return resolve({ ok: false, output: 'Auth SSH tidak lengkap (perlu password atau key path)' })
    }

    const conn = new clientClass()
    let output = ''
    let finished = false
    const finish = (ok) => {
      if (finished) return
      finished = true
      try { conn.end() } catch {}
      resolve({ ok, output: output.trim().slice(0, 4000) })
    }
    const timer = setTimeout(() => finish(false), timeoutMs)

    conn.on('ready', () => {
      console.log('[vnc-setup] ssh ready')
      conn.sftp((err, sftp) => {
        if (err) return finish(false)
        sftp.writeFile('/tmp/wol-vnc-setup.sh', buildVncSetupScript(), (errWrite) => {
          if (errWrite) return finish(false)
          const pass = (device.ssh_password || '').replace(/'/g, `'\\''`)
          const cmd =
            device.ssh_user === 'root'
              ? 'bash /tmp/wol-vnc-setup.sh 2>&1'
              : `printf '%s\\n' '${pass}' | sudo -S -p '' bash /tmp/wol-vnc-setup.sh 2>&1`
          conn.exec(cmd, (err2, stream2) => {
            if (err2) return finish(false)
            stream2.on('data', (d) => {
              output += d.toString()
            })
            stream2.stderr.on('data', (d) => {
              output += d.toString()
            })
            stream2.on('close', () => {
              console.log('[vnc-setup] exec selesai, VNC_READY =', output.includes('VNC_READY'))
              clearTimeout(timer)
              finish(output.includes('VNC_READY'))
            })
          })
        })
      })
    })
    conn.on('error', (err) => {
      clearTimeout(timer)
      finish(false)
    })
    conn.connect(config)
  })
}
