import os from 'node:os'
import dns from 'node:dns/promises'
import fs from 'node:fs'
import { probeHost } from './probe.js'

const PROBE_PORT = 80
const PROBE_TIMEOUT = 700
const CONCURRENCY = 48
const MAX_HOSTS = 2048
const JOB_TTL_MS = 5 * 60 * 1000

export function isPrivate(ip) {
  const parts = ip.split('.').map(Number)
  if (parts[0] === 10) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  return false
}

export function prefixFromMask(mask) {
  return mask.split('.').reduce((acc, octet) => acc + (Number(octet).toString(2).match(/1/g) || []).length, 0)
}

export function rangeHosts(ip, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const ipInt = ip.split('.').reduce((acc, o) => (acc << 8) | Number(o), 0) >>> 0
  const netInt = (ipInt & mask) >>> 0
  const hostCount = Math.pow(2, 32 - prefix) - 2
  if (hostCount > MAX_HOSTS) {
    throw new Error(`Subnet /${prefix} terlalu besar untuk di-scan (max ${MAX_HOSTS} host)`)
  }
  const ips = []
  for (let i = 1; i <= hostCount; i++) {
    const h = (netInt + i) >>> 0
    ips.push([h >>> 24, (h >> 16) & 255, (h >> 8) & 255, h & 255].join('.'))
  }
  return ips
}

export function computeBroadcast(ip, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const ipInt = ip.split('.').reduce((acc, o) => (acc << 8) | Number(o), 0) >>> 0
  const b = (ipInt | (~mask >>> 0)) >>> 0
  return [b >>> 24, (b >> 16) & 255, (b >> 8) & 255, b & 255].join('.')
}

export function getScanRange() {
  const ifaces = os.networkInterfaces()
  const candidates = []
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (name.startsWith('docker') || name.startsWith('veth') || name.startsWith('br-')) continue
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue
      const prefix = prefixFromMask(a.netmask)
      if (prefix < 8 || prefix > 24) continue
      candidates.push({ name, address: a.address, netmask: a.netmask, prefix, private: isPrivate(a.address) })
    }
  }
  candidates.sort((a, b) => Number(b.private) - Number(a.private))
  const chosen = candidates[0]
  if (!chosen) return null
  return {
    name: chosen.name,
    address: chosen.address,
    netmask: chosen.netmask,
    prefix: chosen.prefix,
    broadcast: computeBroadcast(chosen.address, chosen.prefix),
    ips: rangeHosts(chosen.address, chosen.prefix),
  }
}

export function readArpTable(selfIp) {
  const out = {}
  try {
    const data = fs.readFileSync('/proc/net/arp', 'utf8')
    for (const line of data.split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 4) continue
      const ip = parts[0]
      const mac = parts[3]
      if (!ip || ip === selfIp) continue
      if (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac) && mac !== '00:00:00:00:00:00') {
        out[ip] = mac.toLowerCase()
      }
    }
  } catch {}
  return out
}

async function lookupHostname(ip) {
  try {
    const names = await Promise.race([
      dns.reverse(ip),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 500)),
    ])
    return names[0] || null
  } catch {
    return null
  }
}

export class ScanJob {
  constructor(range, deps = {}) {
    this.id = deps.id
    this.range = range
    this.ips = range.ips
    this.probe = deps.probe || probeHost
    this.arpReader = deps.arpReader || readArpTable
    this.resolveHostname = deps.resolveHostname || lookupHostname
    this.saveCache = deps.saveCache || null
    this.probePort = deps.probePort || PROBE_PORT
    this.probeTimeout = deps.probeTimeout || PROBE_TIMEOUT
    this.state = 'idle'
    this.aborted = false
    this.scanned = 0
    this.total = range.ips.length
    this.found = []
    this.createdAt = Date.now()
  }

  async start() {
    if (this.state !== 'idle') return
    this.state = 'running'

    let cursor = 0
    const live = new Set()

    const worker = async () => {
      while (!this.aborted && cursor < this.ips.length) {
        const ip = this.ips[cursor++]
        this.scanned = Math.min(this.scanned + 1, this.ips.length)
        const ok = await this.probe(ip, this.probePort, this.probeTimeout, () => this.aborted)
        if (ok) live.add(ip)
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
    if (this.aborted) {
      this.state = 'aborted'
      return
    }

    this.state = 'enriching'
    this.scanned = this.ips.length
    const arp = this.arpReader(this.range.address)
    const ips = [...live]
    let hCursor = 0
    const hWorker = async () => {
      while (!this.aborted && hCursor < ips.length) {
        const ip = ips[hCursor++]
        const hostname = await this.resolveHostname(ip)
        this.found.push({ ip, mac: arp[ip] || null, hostname })
      }
    }
    await Promise.all(Array.from({ length: 12 }, () => hWorker()))

    if (this.aborted) {
      this.state = 'aborted'
      return
    }
    this.state = 'done'
    if (this.saveCache) {
      this.saveCache(this.found, `${this.range.address}/${this.range.prefix}`, this.range.broadcast)
    }
  }

  abort() {
    this.aborted = true
  }

  isRunning() {
    return this.state === 'running' || this.state === 'enriching'
  }
}

export function createScanRegistry(deps = {}) {
  const jobs = new Map()
  let jobSeq = 0

  return {
    start(range) {
      for (const [key, old] of jobs) {
        if (!old.isRunning() && Date.now() - old.createdAt > JOB_TTL_MS) jobs.delete(key)
      }
      const job = new ScanJob(range, { ...deps, id: `scan-${++jobSeq}` })
      jobs.set(job.id, job)
      job.start().catch((err) => {
        console.error(`[scan] ${job.id} error:`, err.message)
        job.state = 'aborted'
      })
      return job
    },

    get(id) {
      return jobs.get(id) ?? null
    },
  }
}
