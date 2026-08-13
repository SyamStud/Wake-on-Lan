import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVncSetupScript, buildVncHeadlessScript } from '../src/remote-setup.js'

test('script setup VNC: berisi komponen wajib', () => {
  const script = buildVncSetupScript()
  assert.match(script, /x11vnc\.service/)
  assert.match(script, /-noxdamage -nowf -noscr -nodpms/)
  assert.match(script, /Restart=always/)
  assert.match(script, /systemctl daemon-reload/)
  assert.match(script, /VNC_READY/)
  assert.match(script, /apt-get install -y x11vnc/)
  assert.match(script, /apk add x11vnc/)
  assert.match(script, /setsid x11vnc/)
})

test('script setup VNC: tidak memakai opsi yang tidak didukung', () => {
  const script = buildVncSetupScript()
  assert.ok(!script.includes('-foreground'), 'x11vnc build tertentu tidak mendukung -foreground')
})

test('script headless: Xvfb + desktop + x11vnc di display :1', () => {
  const script = buildVncHeadlessScript()
  assert.match(script, /Xvfb :1 -screen 0 1280x720x24/)
  assert.match(script, /startxfce4/)
  assert.match(script, /x11vnc -display :1/)
  assert.match(script, /VNC_READY/)
  assert.match(script, /xfce4 xfce4-terminal dbus-x11/)
  assert.ok(!script.includes('-auth guess'), 'headless tidak butuh auth guess')
})
