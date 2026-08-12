import net from 'node:net'

export function probeHost(host, port, timeoutMs, isAborted = () => false) {
  return new Promise((resolve) => {
    if (isAborted()) return resolve(false)
    const sock = new net.Socket()
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      sock.destroy()
      resolve(ok)
    }
    sock.setTimeout(timeoutMs)
    sock.once('connect', () => finish(true))
    sock.once('timeout', () => finish(false))
    sock.once('error', () => finish(false))
    sock.connect(port, host)
  })
}
