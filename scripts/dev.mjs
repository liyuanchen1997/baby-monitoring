/**
 * 开发环境一键启动编排
 * 1. 检测 LAN IP、检查证书
 * 2. 并行启动后端（server/index.mjs, :3443，模块 2 加入）与前端（vite, :5173）
 * 3. 打印各设备访问清单
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { listLanIPv4s } from '../server/lan.mjs'

const SERVER_PORT = 3443
const VITE_PORT = 5173
const children = []

if (!fs.existsSync('certs/dev-cert.pem') || !fs.existsSync('certs/dev-key.pem')) {
  console.error('❌ HTTPS 证书不存在，请先运行: npm run cert')
  process.exit(1)
}

// 后端（server/index.mjs 在模块 2 落地后生效）
if (fs.existsSync('server/index.mjs')) {
  const server = spawn('node', ['server/index.mjs'], { stdio: 'inherit' })
  children.push(server)
} else {
  console.log('ℹ️  后端尚未实现（模块 2），本次仅启动前端')
}

const vite = spawn('npx', ['vite'], { stdio: 'inherit' })
children.push(vite)

for (const child of children) {
  child.on('exit', (code) => {
    // 任一子进程退出即整体停止
    for (const c of children) if (c !== child && !c.killed) c.kill()
  })
}

process.on('SIGINT', () => {
  for (const c of children) if (!c.killed) c.kill()
  process.exit(0)
})

console.log('\n=== 👶 宝宝监控 访问清单 ===')
console.log(`macOS 本机:     https://localhost:${VITE_PORT}`)
for (const ip of listLanIPv4s()) {
  console.log(`手机/其他设备:  https://${ip}:${VITE_PORT}`)
}
console.log(`观看端 URL:     https://<上面的地址>/?join=<房间码>`)
console.log(`手机首次使用需安装证书：npm run cert:serve（见 README）\n`)
