/**
 * HTTPS 证书生成脚本
 * 原理：mkcert 在电脑上创建本地 CA，用它为 localhost + 全部局域网 IP 签发服务器证书。
 * 手机浏览器调用 getUserMedia 必须 HTTPS（安全上下文），且必须信任本地 CA——
 * 手机端一次性安装根证书（见 README / serve-cert.mjs 提供下载）。
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { listLanIPv4s } from '../server/lan.mjs'

const CERT_DIR = 'certs'
const CERT = path.join(CERT_DIR, 'dev-cert.pem')
const KEY = path.join(CERT_DIR, 'dev-key.pem')

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

// 1. 检查 mkcert
try {
  execSync('which mkcert', { stdio: 'pipe' })
} catch {
  console.error('❌ mkcert 未安装，请先运行: brew install mkcert nss')
  process.exit(1)
}

// 2. 安装本地 CA 到系统信任库（macOS 需要管理员授权）
//    非交互终端下授权可能失败——不影响证书签发与手机端使用：
//    localhost 浏览器有安全上下文豁免；手机端只认 rootCA 是否已安装。
//    想获得 macOS 本机绿锁，可自行在终端运行一次: mkcert -install
try {
  console.log('⏳ 安装本地 CA 到系统信任库（如需授权请允许）…')
  run('mkcert -install')
} catch {
  console.warn(
    '⚠️  本机 CA 未能写入系统钥匙串（非交互终端无授权权限）。\n' +
    '   不影响证书生成与手机端使用；如需 macOS 本机绿锁，请在终端自行运行: mkcert -install'
  )
}

// 3. 签发服务器证书（SAN 含 localhost + 全部 LAN IP）
fs.mkdirSync(CERT_DIR, { recursive: true })
const hosts = ['localhost', '127.0.0.1', ...listLanIPv4s()]
run(`mkcert -key-file ${KEY} -cert-file ${CERT} ${hosts.join(' ')}`)

// 4. 输出信息
const caroot = execSync('mkcert -CAROOT', { encoding: 'utf8' }).trim()
console.log(`\n✅ 证书已生成: ${CERT}`)
console.log(`   SAN: ${hosts.join(', ')}`)
console.log(`   根证书: ${caroot}/rootCA.pem`)
console.log(`   手机安装根证书：运行 npm run cert:serve，手机访问 http://<电脑IP>:8080（详见 README）`)
