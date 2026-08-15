/**
 * 根证书伺服脚本（纯 HTTP :8080）
 * 用途：手机浏览器访问未信任的 HTTPS 页面时无法下载文件（鸡生蛋问题），
 * 因此用普通 HTTP 伺服 rootCA.pem 供手机下载安装。
 * 下载后按 README 指引安装（iOS 描述文件 / Android Firefox 安装 CA）。
 */
import { execSync } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { listLanIPv4s } from '../server/lan.mjs'

// 端口可被环境变量覆盖；遇占用自动递增避让（最多试 10 个）
const BASE_PORT = Number(process.env.PORT || 8080)
const caroot = execSync('mkcert -CAROOT', { encoding: 'utf8' }).trim()
const rootCaPath = path.join(caroot, 'rootCA.pem')

if (!fs.existsSync(rootCaPath)) {
  console.error(`❌ 根证书不存在: ${rootCaPath}。请先运行: npm run cert`)
  process.exit(1)
}

const PAGE = `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>安装监控证书</title>
<body style="font-family:sans-serif;max-width:560px;margin:48px auto;padding:0 16px">
<h2>👶 宝宝监控 · 安装根证书</h2>
<p>点击下方按钮下载根证书（rootCA.pem），然后按你的设备类型安装：</p>
<p><a href="/rootCA.pem" download style="display:inline-block;background:#38bdf8;color:#082f49;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600">⬇️ 下载根证书 rootCA.pem</a></p>
<h3>📱 iPhone</h3>
<ol><li>下载后到「设置」→ 已下载描述文件</li>
<li>安装描述文件</li>
<li>设置 → 通用 → 关于本机 → 证书信任设置 → 开启「完全信任」</li></ol>
<h3>🤖 Android（请用 Firefox 下载）</h3>
<ol><li>设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书</li>
<li>选择下载的 rootCA.pem</li>
<li>Chrome 默认不信任用户 CA，请用 Firefox 访问监控页面</li></ol>
<p style="color:#64748b">完成后即可用 https:// 访问宝宝监控页面，摄像头权限可用。</p>
</body>`

const server = http.createServer((req, res) => {
  if (req.url === '/rootCA.pem') {
    res.writeHead(200, {
      'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': 'attachment; filename="rootCA.pem"',
    })
    fs.createReadStream(rootCaPath).pipe(res)
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(PAGE)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️  端口 ${BASE_PORT + tries} 被占用，尝试下一个…`)
    tries += 1
    if (tries > 10) {
      console.error('❌ 连续 10 个端口均被占用，请设置环境变量 PORT 指定端口')
      process.exit(1)
    }
    server.listen(BASE_PORT + tries)
    return
  }
  throw err
})

let tries = 0
server.listen(BASE_PORT, () => {
  const port = BASE_PORT + tries
  console.log(`✅ 根证书伺服已启动（端口 ${port}），手机浏览器访问：`)
  for (const ip of listLanIPv4s()) console.log(`   http://${ip}:${port}`)
  console.log('   安装完成后可 Ctrl+C 停止本服务')
})
