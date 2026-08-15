/**
 * WebSocket 信令服务器（挂载于 /ws）
 *
 * 职责：
 * - 房间管理（一房 2 peer：camera 拍摄端 + viewer 观看端）
 * - 消息中继（offer/answer/ice 原样转发，不解析 SDP，不做存储）
 * - 心跳保活（30s ping，清理手机 WiFi 睡眠导致的半开连接）
 * - activity（检测状态）最新缓存与补发/离线错过提示
 *
 * 关键约定（见 doc/设计文档.md §3）：
 * - 拍摄端恒为唯一 offerer，观看端只应答 → 协议上不存在 glare
 * - 房间生命周期绑定拍摄端 WS：拍摄端断开即删房；观看端断开仅清槽位
 * - 发送失败立即 terminate 该死连接并清理，避免把对端晾着等 TCP 超时
 */
import { WebSocketServer } from 'ws'

const HEARTBEAT_MS = 30_000
const CODE_CHARS = '23456789' // 去掉 0/1，避免显示混淆

export function attachSignaling(server) {
  const wss = new WebSocketServer({ server, path: '/ws' })
  const rooms = new Map() // code -> { code, camera, viewer, activity, cameraSeq, viewerSeq }
  const sockets = new Map() // ws -> { code, role: 'camera' | 'viewer' }（反向索引，断开清理用）

  function randomCode() {
    let code
    do {
      code = Array.from(
        { length: 6 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join('')
    } while (rooms.has(code))
    return code
  }

  function send(ws, type, payload = {}) {
    if (ws.readyState !== ws.OPEN) return false
    try {
      ws.send(JSON.stringify({ type, ...payload }))
      return true
    } catch {
      ws.terminate() // 发送失败视为死连接
      return false
    }
  }

  function peerOf(room, ws) {
    return ws === room.camera ? room.viewer : room.camera
  }

  /** 根据 socket 反向索引清理其在房间中的占位 */
  function cleanup(ws) {
    const entry = sockets.get(ws)
    if (!entry) return
    sockets.delete(ws)
    const room = rooms.get(entry.code)
    if (!room) return

    if (entry.role === 'camera') {
      // 拍摄端断开 → 删除整个房间，通知观看端
      rooms.delete(entry.code)
      if (room.viewer && room.viewer !== ws) {
        sockets.delete(room.viewer)
        send(room.viewer, 'peer-left', { reason: 'camera-left' })
      }
    } else {
      // 观看端断开 → 仅清槽位，房间保留
      room.viewer = null
      if (room.camera && room.camera !== ws) {
        send(room.camera, 'peer-left', { reason: 'viewer-left' })
      }
    }
  }

  function handleMessage(ws, msg) {
    const entry = sockets.get(ws)
    const room = entry ? rooms.get(entry.code) : null

    switch (msg.type) {
      case 'create-room': {
        // 重复建房（如重连后）先退出旧房间，保证幂等
        if (entry) cleanup(ws)

        let code = msg.code
        if (code) {
          const existing = rooms.get(code)
          if (existing && existing.camera !== ws && existing.camera.readyState === existing.camera.OPEN) {
            send(ws, 'error', { message: 'code-taken' })
            return
          }
          // 房间存在且 camera 槽就是本 ws（重复 create 同码）→ 幂等复用
        } else {
          code = randomCode()
        }

        if (!rooms.has(code)) {
          rooms.set(code, { code, camera: ws, viewer: null, activity: null, cameraSeq: 0, viewerSeq: 0 })
        }
        sockets.set(ws, { code, role: 'camera' })
        send(ws, 'room-created', { code })
        return
      }

      case 'join-room': {
        const code = msg.code
        const room = rooms.get(code)
        if (!room) {
          send(ws, 'room-joined', { ok: false, reason: 'room-not-found' })
          return
        }
        if (room.viewer && room.viewer !== ws) {
          send(ws, 'room-joined', { ok: false, reason: 'room-full' })
          return
        }
        sockets.set(ws, { code, role: 'viewer' })
        room.viewer = ws
        send(ws, 'room-joined', { ok: true, code })
        send(room.camera, 'peer-joined', {})
        // 补发缓存的最新检测状态 + 离线错过提示
        if (room.activity) send(ws, 'activity', room.activity)
        const missed = room.cameraSeq - room.viewerSeq
        if (missed > 0) send(ws, 'activity-backlog', { missed })
        return
      }

      case 'offer':
      case 'answer':
      case 'ice':
      case 'restart-request': {
        if (!room) return
        const peer = peerOf(room, ws)
        if (peer) {
          send(peer, msg.type, msg.type === 'ice' ? { candidate: msg.candidate } : { sdp: msg.sdp })
        }
        return
      }

      case 'activity': {
        // 仅拍摄端可上报检测状态
        if (!entry || entry.role !== 'camera' || !room) return
        room.activity = { state: msg.state, seq: msg.seq, ts: msg.ts }
        room.cameraSeq = msg.seq
        if (room.viewer && room.viewer !== ws) {
          room.viewerSeq = msg.seq
          send(room.viewer, 'activity', room.activity)
        }
        return
      }

      case 'leave':
        cleanup(ws)
        return

      case 'ping':
        send(ws, 'pong', {})
        return
    }
  }

  wss.on('connection', (ws) => {
    ws.isAlive = true
    ws.on('pong', () => {
      ws.isAlive = true
    })
    ws.on('message', (data) => {
      let msg
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }
      handleMessage(ws, msg)
    })
    ws.on('close', () => cleanup(ws))
    ws.on('error', () => {}) // close 会触发清理
  })

  // 心跳：清理假死连接
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      ws.ping()
    }
  }, HEARTBEAT_MS)
  wss.on('close', () => clearInterval(heartbeat))

  return wss
}
