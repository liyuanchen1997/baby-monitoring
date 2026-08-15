/**
 * 后端入口：HTTPS + Express + WebSocket 信令
 * - GET /api/info    → { lanIp }，供前端二维码生成（拍摄端经 localhost 打开时也能指向 LAN IP）
 * - GET /ws          → WebSocket 信令（attachSignaling）
 * - 静态服务         → dist/ 存在时挂载（生产模式 npm run build && npm run start）
 */
import express from 'express'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachSignaling } from './signaling.mjs'
import { listLanIPv4s } from './lan.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3443)

const app = express()
app.use(express.json())

app.get('/api/info', (_req, res) => {
  res.json({ lanIp: listLanIPv4s()[0] ?? null })
})

// 生产模式静态服务（dist 存在才挂载；开发模式由 vite 提供前端）
const distDir = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  // SPA fallback（express 5 通配符语法变更，用中间件兜底）
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      next()
      return
    }
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const server = https.createServer(
  {
    key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'dev-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'dev-cert.pem')),
  },
  app,
)

attachSignaling(server)

server.listen(PORT, () => {
  console.log(`✅ 服务器已启动: https://localhost:${PORT}`)
  for (const ip of listLanIPv4s()) console.log(`   https://${ip}:${PORT}`)
})
