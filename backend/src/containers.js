import { execViaSsh } from './ssh.js'

const ACTIONS = new Set(['start', 'stop', 'restart'])
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/

export function parseDockerPs(raw) {
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .map((c) => ({
      id: c.ID || '',
      name: (c.Names || '').replace(/^\/+/, ''),
      image: c.Image || '',
      state: c.State || '',
      status: c.Status || '',
      ports: c.Ports || '',
    }))
}

export function createContainers({ exec = execViaSsh } = {}) {
  async function listContainers(device) {
    const res = await exec(
      device,
      "command -v docker >/dev/null 2>&1 && docker ps -a --format '{{json .}}' || echo DOCKER_UNAVAILABLE",
    )
    if (res.stdout === 'DOCKER_UNAVAILABLE') {
      throw new Error('Docker tidak terpasang di device ini')
    }
    if (res.code !== 0 && !res.stdout) {
      throw new Error(`Gagal membaca container: ${res.stderr || res.stdout}`)
    }
    return parseDockerPs(res.stdout)
  }

  async function containerAction(device, name, action) {
    if (!ACTIONS.has(action)) throw new Error(`Aksi container tidak valid: ${action}`)
    if (!NAME_RE.test(name)) throw new Error('Nama container tidak valid')
    const res = await exec(device, `docker ${action} ${name}`)
    if (res.code !== 0) {
      throw new Error(`Gagal ${action} container ${name}: ${res.stderr || res.stdout}`)
    }
    return res.stdout
  }

  return { listContainers, containerAction }
}
