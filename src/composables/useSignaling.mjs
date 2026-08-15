/**
 * 信令 WebSocket 封装（L0 连接层）
 * - 同源推导地址（dev: vite proxy → 后端；prod: 同端口）
 * - 断线指数退避重连（1s → 30s 封顶）
 * - 按 type 分发消息；on() 返回取消函数
 * - 每 20s 发送 ping 保活
 *
 * 注：重连后由调用方负责重发 create-room（带恢复码）/ join-room（见视图），
 *     本层只保证 WS 连接恢复。
 */
import { ref } from 'vue'
import { CONFIG } from '../config.js'

export function useSignaling() {
  const status = ref('disconnected') // disconnected | connecting | connected
  const handlers = new Map() // type -> [cb, ...]
  let ws = null
  let retryMs = CONFIG.reconnect.wsBaseMs
  let manualClose = false
  let pingTimer = null

  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}${CONFIG.signalingPath}`
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    manualClose = false
    status.value = 'connecting'
    ws = new WebSocket(wsUrl())

    ws.onopen = () => {
      status.value = 'connected'
      retryMs = CONFIG.reconnect.wsBaseMs
      clearInterval(pingTimer)
      pingTimer = setInterval(() => send('ping'), 20_000)
    }

    ws.onmessage = (e) => {
      let msg
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      const list = handlers.get(msg.type)
      if (list) for (const cb of list) cb(msg)
    }

    ws.onclose = () => {
      status.value = 'disconnected'
      clearInterval(pingTimer)
      if (!manualClose) scheduleReconnect()
    }

    ws.onerror = () => {} // onclose 会随后触发
  }

  function scheduleReconnect() {
    setTimeout(() => {
      if (manualClose) return
      connect()
    }, retryMs)
    retryMs = Math.min(retryMs * 2, CONFIG.reconnect.wsMaxMs)
  }

  function send(type, payload = {}) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }))
    }
  }

  function on(type, cb) {
    if (!handlers.has(type)) handlers.set(type, [])
    handlers.get(type).push(cb)
    return () => {
      const list = handlers.get(type)
      if (!list) return
      const i = list.indexOf(cb)
      if (i >= 0) list.splice(i, 1)
    }
  }

  function close() {
    manualClose = true
    clearInterval(pingTimer)
    ws?.close()
  }

  return { status, connect, send, on, close }
}
