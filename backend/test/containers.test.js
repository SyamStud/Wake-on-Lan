import test from 'node:test'
import assert from 'node:assert/strict'
import { createContainers, parseDockerPs } from '../src/containers.js'

const device = {
  id: 1,
  name: 'PC Kamar',
  ssh_host: '192.168.1.50',
  ssh_port: 22,
  ssh_user: 'user',
}

test('parseDockerPs mem-parsing baris JSON dari docker ps', () => {
  const raw = [
    JSON.stringify({ ID: 'abc123', Names: '/web', Image: 'nginx:latest', State: 'running', Status: 'Up 2 days', Ports: '0.0.0.0:8080->80/tcp' }),
    JSON.stringify({ ID: 'def456', Names: '/db', Image: 'postgres:16', State: 'exited', Status: 'Exited (0) 1 hour ago', Ports: '' }),
    'bukan json',
  ].join('\n')
  const parsed = parseDockerPs(raw)
  assert.equal(parsed.length, 2)
  assert.deepEqual(parsed[0], {
    id: 'abc123',
    name: 'web',
    image: 'nginx:latest',
    state: 'running',
    status: 'Up 2 days',
    ports: '0.0.0.0:8080->80/tcp',
  })
  assert.equal(parsed[1].name, 'db')
})

test('parseDockerPs mengembalikan array kosong untuk input kosong', () => {
  assert.deepEqual(parseDockerPs(''), [])
  assert.deepEqual(parseDockerPs(null), [])
})

test('listContainers menjalankan docker ps dan mengembalikan daftar', async () => {
  let command = null
  const exec = async (dev, cmd) => {
    command = cmd
    return {
      code: 0,
      stdout: JSON.stringify({ ID: 'abc', Names: '/web', Image: 'nginx', State: 'running', Status: 'Up 1h', Ports: '' }),
      stderr: '',
    }
  }
  const containers = createContainers({ exec })
  const list = await containers.listContainers(device)
  assert.match(command, /docker ps -a/)
  assert.equal(list.length, 1)
  assert.equal(list[0].name, 'web')
})

test('listContainers menolak jika docker tidak terpasang', async () => {
  const containers = createContainers({
    exec: async () => ({ code: 0, stdout: 'DOCKER_UNAVAILABLE', stderr: '' }),
  })
  await assert.rejects(() => containers.listContainers(device), /Docker tidak terpasang/)
})

test('containerAction meneruskan aksi valid dan menolak aksi tidak valid', async () => {
  const calls = []
  const containers = createContainers({
    exec: async (dev, cmd) => {
      calls.push(cmd)
      return { code: 0, stdout: 'web', stderr: '' }
    },
  })
  await containers.containerAction(device, 'web', 'restart')
  assert.deepEqual(calls, ['docker restart web'])

  await assert.rejects(() => containers.containerAction(device, 'web', 'rm'), /tidak valid/)
  await assert.rejects(() => containers.containerAction(device, 'bad;name', 'start'), /tidak valid/)
})

test('containerAction meneruskan error dari perintah docker', async () => {
  const containers = createContainers({
    exec: async () => ({ code: 1, stdout: '', stderr: 'No such container: web' }),
  })
  await assert.rejects(() => containers.containerAction(device, 'web', 'stop'), /No such container/)
})
