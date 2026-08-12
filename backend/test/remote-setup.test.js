import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVncSetupScript } from '../src/remote-setup.js'

test('script setup VNC: berisi komponen wajib', () => {
  const script = buildVncSetupScript()
  assert.match(script, /x11vnc\.service/)
  assert.match(script, /-noxdamage -nowf -noscr -nodpms/)
  assert.match(script, /Restart=always/)
  assert.match(script, /systemctl daemon-reload/)
  assert.match(script, /VNC_READY/)
  assert.match(script, /apt-get install -y x11vnc/)
  assert.match(script, /apk add x11vnc/)
  assert.match(script, /nohup x11vnc/)
})

test('script setup VNC: tidak memakai opsi yang tidak didukung', () => {
  const script = buildVncSetupScript()
  assert.ok(!script.includes('-foreground'), 'x11vnc build tertentu tidak mendukung -foreground')
})
