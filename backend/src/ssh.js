import fs from 'node:fs'
import { Client } from 'ssh2'
import { probeHost } from './probe.js'

export function shutdownViaSsh(device) {
  const { ssh_host, ssh_port, ssh_user, ssh_auth, ssh_key_path, ssh_password } = device
  if (!ssh_host || !ssh_user) {
    return Promise.reject(new Error('Konfigurasi SSH device belum lengkap'))
  }

  return new Promise((resolve, reject) => {
    const conn = new Client()
    const config = { host: ssh_host, port: ssh_port || 22, username: ssh_user, readyTimeout: 10000 }
    if (ssh_auth === 'password' && ssh_password) {
      config.password = ssh_password
    } else if (ssh_key_path) {
      try {
        config.privateKey = fs.readFileSync(ssh_key_path)
      } catch (err) {
        return reject(new Error(`Tidak bisa membaca SSH key ${ssh_key_path}: ${err.message}`))
      }
    } else {
      return reject(new Error('Auth SSH tidak lengkap (perlu password atau key path)'))
    }

    let finished = false
    const done = (err, msg) => {
      if (finished) return
      finished = true
      conn.end()
      if (err) reject(err)
      else resolve(msg)
    }

    conn.on('ready', () => {
      conn.exec('sudo -n shutdown -h now', (err, stream) => {
        if (err) return done(err)
        let stdout = ''
        let stderr = ''
        stream.on('close', (code) => {
          if (code === 0) return done(null, 'Perintah shutdown terkirim')
          if (ssh_auth === 'password' && ssh_password) {
            conn.exec('sudo -S shutdown -h now', (err2, stream2) => {
              if (err2) return done(err2)
              stream2.stdin.write(ssh_password + '\n')
              stream2.stdin.end()
              let out2 = ''
              let err2out = ''
              stream2.on('data', (d) => (out2 += d.toString()))
              stream2.stderr.on('data', (d) => (err2out += d.toString()))
              stream2.on('close', (code2) => {
                if (code2 === 0) return done(null, 'Perintah shutdown terkirim')
                done(new Error(`Shutdown gagal (exit ${code2}): ${(err2out || out2).trim()}`))
              })
            })
          } else {
            done(new Error(`Shutdown gagal (exit ${code}): ${(stderr || stdout).trim()}`))
          }
        })
        stream.on('data', (d) => (stdout += d.toString()))
        stream.stderr.on('data', (d) => (stderr += d.toString()))
      })
    })
    conn.on('error', (err) => done(err))
    conn.connect(config)
  })
}

export function checkOnline(host, port = 22, timeoutMs = 1500) {
  if (!host) return Promise.resolve(false)
  return probeHost(host, port, timeoutMs)
}
