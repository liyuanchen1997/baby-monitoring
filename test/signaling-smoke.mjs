/**
 * 信令生命周期冒烟测试
 * 起一个真实 https 服务器 + signaling（复用 certs/ 证书），
 * 多个 ws 客户端模拟完整生命周期并断言：
 * 建房 → 加入 → offer/answer/ice 中继 → activity 流转与补发/backlog →
 * 满员拒绝 → 离开通知 → 恢复码重建 → 同码冲突 → 不存在房间 → ping/pong
 *
 * 运行: npm run smoke
 */
import { WebSocket } from 'ws'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachSignaling } from '../server/signaling.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let passed = 0
let failed = 0
function assert(name, cond) {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.error(`  ❌ ${name}`)
  }
}

/**
 * 带消息队列的 ws 客户端：服务器连续发来的多条消息（如 room-joined + activity）
 * 不会因监听器切换间隙而丢失——这正是真实前端需要的语义。
 */
function open(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { rejectUnauthorized: false })
    const queue = []
    const waiters = []
    ws.on('open', () => resolve(client))
    ws.on('error', reject)
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      const idx = waiters.findIndex((w) => w.type === msg.type)
      if (idx >= 0) {
        const w = waiters.splice(idx, 1)[0]
        clearTimeout(w.timer)
        w.resolve(msg)
      } else {
        queue.push(msg)
      }
    })

    function once(type, timeoutMs = 3000) {
      const found = queue.findIndex((m) => m.type === type)
      if (found >= 0) return Promise.resolve(queue.splice(found, 1)[0])
      return new Promise((resolveOnce, rejectOnce) => {
        const timer = setTimeout(() => {
          const i = waiters.findIndex((w) => w.type === type)
          if (i >= 0) waiters.splice(i, 1)
          rejectOnce(new Error(`等待 ${type} 超时`))
        }, timeoutMs)
        waiters.push({ type, resolve: resolveOnce, timer })
      })
    }

    const client = {
      ws,
      send: (payload) => ws.send(JSON.stringify(payload)),
      once,
    }
  })
}

const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'dev-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'dev-cert.pem')),
})
attachSignaling(server)
await new Promise((r) => server.listen(0, r))
const url = `wss://localhost:${server.address().port}/ws`

console.log('信令冒烟测试:')
const all = []
try {
  // 1. 拍摄端建房
  const camera = await open(url)
  all.push(camera)
  camera.send({ type: 'create-room' })
  const created = await camera.once('room-created')
  assert('拍摄端建房获得 6 位房间码', /^\d{6}$/.test(created.code))

  // 2. 观看端加入
  const viewer = await open(url)
  all.push(viewer)
  viewer.send({ type: 'join-room', code: created.code })
  const joined = await viewer.once('room-joined')
  assert('观看端加入成功', joined.ok === true)
  assert('拍摄端收到 peer-joined', (await camera.once('peer-joined')).type === 'peer-joined')

  // 3. offer/answer/ice 中继
  camera.send({ type: 'offer', sdp: 'test-sdp-offer' })
  assert('offer 中继到观看端', (await viewer.once('offer')).sdp === 'test-sdp-offer')
  viewer.send({ type: 'answer', sdp: 'test-sdp-answer' })
  assert('answer 中继到拍摄端', (await camera.once('answer')).sdp === 'test-sdp-answer')
  viewer.send({ type: 'ice', candidate: { candidate: 'cand-1', sdpMid: '0' } })
  assert('ice 中继到拍摄端', (await camera.once('ice')).candidate.candidate === 'cand-1')

  // 4. activity 流转（观看端在场）→ viewerSeq=1
  camera.send({ type: 'activity', state: 'crying', seq: 1, ts: 123 })
  assert('观看端收到 activity', (await viewer.once('activity')).state === 'crying')

  // 5. 观看端离开 → 拍摄端收 viewer-left
  viewer.send({ type: 'leave' })
  assert('拍摄端收到 viewer-left', (await camera.once('peer-left')).reason === 'viewer-left')

  // 6. 观看端离线期间 camera 再上报（seq=2，无转发但更新 cameraSeq）
  camera.send({ type: 'activity', state: 'moving', seq: 2, ts: 124 })

  // 7. 观看端重连（rejoin）→ 补发最新 activity + 离线错过提示 missed=1
  const viewer2 = await open(url)
  all.push(viewer2)
  viewer2.send({ type: 'join-room', code: created.code, rejoin: true })
  const joined2 = await viewer2.once('room-joined')
  assert('观看端重连加入成功', joined2.ok === true)
  assert('重连观看端补发最新 activity', (await viewer2.once('activity')).state === 'moving')
  assert('重连观看端收到离线错过提示 missed=1', (await viewer2.once('activity-backlog')).missed === 1)

  // 7b. 新观看端首次加入（无 rejoin）→ 不报"错过"（viewerSeq 是上一会话残留值）
  viewer2.send({ type: 'leave' }) // 先腾出 viewer 槽
  const viewer3 = await open(url)
  all.push(viewer3)
  viewer3.send({ type: 'join-room', code: created.code })
  const joined3 = await viewer3.once('room-joined')
  assert('新观看端首次加入成功', joined3.ok === true)
  let backlogLeak = false
  try {
    await viewer3.once('activity-backlog', 500)
    backlogLeak = true
  } catch {
    // 超时 = 未收到 backlog ✓
  }
  assert('新观看端首次加入不误报错过', backlogLeak === false)

  // 8. 满员拒绝（viewer3 在槽内）
  const viewer4 = await open(url)
  all.push(viewer4)
  viewer4.send({ type: 'join-room', code: created.code })
  assert('满员拒绝 room-full', (await viewer4.once('room-joined')).reason === 'room-full')

  // 9. 拍摄端离开 → 删房 + 通知在场观看端 camera-left
  camera.send({ type: 'leave' })
  assert('观看端收到 camera-left', (await viewer3.once('peer-left')).reason === 'camera-left')

  // 10. 恢复码重建
  const camera2 = await open(url)
  all.push(camera2)
  camera2.send({ type: 'create-room', code: created.code })
  const recreated = await camera2.once('room-created')
  assert('恢复码重建同码房间', recreated.code === created.code)

  // 11. 同码被占报错
  const camera3 = await open(url)
  all.push(camera3)
  camera3.send({ type: 'create-room', code: created.code })
  assert('房间被占报 code-taken', (await camera3.once('error')).message === 'code-taken')

  // 12. 不存在的房间
  camera3.send({ type: 'join-room', code: '999999' })
  assert('不存在房间报 room-not-found', (await camera3.once('room-joined')).reason === 'room-not-found')

  // 13. ping/pong
  camera3.send({ type: 'ping' })
  assert('ping/pong 正常', (await camera3.once('pong')).type === 'pong')
} catch (err) {
  failed++
  console.error(`  ❌ 流程异常: ${err.message}`)
} finally {
  for (const c of all) c.ws.close()
  server.close()
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed ? 1 : 0)
