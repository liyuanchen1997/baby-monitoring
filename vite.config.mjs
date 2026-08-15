import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'

// 证书由 scripts/cert.mjs 生成（模块 1）。证书存在时启用 HTTPS：
// 手机浏览器调用 getUserMedia 必须 HTTPS（安全上下文）；开发模式同样如此。
const CERT = 'certs/dev-cert.pem'
const KEY = 'certs/dev-key.pem'
const hasCerts = fs.existsSync(CERT) && fs.existsSync(KEY)

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // 局域网可访问
    port: 5173,
    https: hasCerts
      ? { key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) }
      : undefined,
    proxy: {
      // 信令 WS + /api 代理到后端（server/index.mjs, 端口 3443）
      '/ws': {
        target: hasCerts ? 'wss://localhost:3443' : 'ws://localhost:3443',
        ws: true,
        secure: false,
      },
      '/api': { target: 'http://localhost:3443', secure: false },
    },
  },
})
