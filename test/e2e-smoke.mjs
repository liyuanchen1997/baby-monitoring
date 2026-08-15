/**
 * E2E 冒烟测试（Playwright + 模拟摄像头/麦克风）
 * 自动验证：双标签互看实时画面、按住说话、控制台无错误
 *
 * 前置：dev 环境已启动（npm run dev）
 * 运行: npm run e2e
 */
import { chromium } from 'playwright'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'

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

// 确保 dev 在跑
function ensureDev() {
  try {
    execSync('curl -sk -o /dev/null -w "%{http_code}" https://localhost:5173/', {
      timeout: 5000,
    })
    return
  } catch {
    console.log('⏳ 启动 dev 环境…')
    spawn('npm', ['run', 'dev'], { stdio: 'inherit', detached: true }).unref()
    execSync('sleep 6')
  }
}

ensureDev()

const browser = await chromium.launch({
  headless: true,
  ignoreHTTPSErrors: true, // 自签证书
  args: [
    '--use-fake-device-for-media-stream', // 模拟摄像头+麦克风
    '--use-fake-ui-for-media-stream', // 自动允许权限
    // ignoreHTTPSErrors 只跳过证书校验，仍需把源标记为安全上下文才能用 gUM
    '--unsafely-treat-insecure-origin-as-secure=https://localhost:5173',
  ],
})

console.log('E2E 冒烟测试:')
const ctx = await browser.newContext()
const pageA = await ctx.newPage() // 拍摄端
const pageB = await ctx.newPage() // 观看端
const consoleErrors = []
for (const p of [pageA, pageB]) {
  p.on('pageerror', (e) => consoleErrors.push(e.message))
}

try {
  // ---- 场景 1：拍摄端建房 + 开始监控 ----
  await pageA.goto('https://localhost:5173')
  await pageA.click('text=开始监控') // HomeView → 拍摄端视图
  await pageA.waitForSelector('.code', { timeout: 10000 })
  const code = (await pageA.textContent('.code')).trim()
  assert('拍摄端获取 6 位房间码', /^\d{6}$/.test(code))
  await pageA.click('.controls .btn-primary') // 拍摄端的「开始监控」→ 启动摄像头

  // 本地预览有画面
  await pageA.waitForFunction(
    () => document.querySelector('.preview video')?.videoWidth > 0,
    { timeout: 15000 },
  )
  assert('拍摄端本地预览画面', true)

  // ---- 场景 2：观看端加入并收到实时画面 ----
  await pageB.goto(`https://localhost:5173/?join=${code}`)
  await pageB.waitForFunction(
    () => document.querySelector('.stage video')?.videoWidth > 0,
    { timeout: 20000 },
  )
  assert('观看端收到实时画面', true)
  await pageB.screenshot({ path: '/tmp/e2e-viewer.png' })

  // ---- 场景 3：按住说话 → 拍摄端收到远端音频流 ----
  await pageB.waitForSelector('.talk')
  await pageB.locator('.talk').dispatchEvent('mousedown')
  await pageB.waitForTimeout(2000) // 等 replaceTrack + 媒体建立
  const talkState = await pageA.evaluate(() => {
    const a = document.querySelector('audio.hidden-audio')
    return a?.srcObject ? a.srcObject.getAudioTracks().length : 0
  })
  assert('按住说话 → 拍摄端收到对讲音频流', talkState > 0)
  const noTalkError = await pageB.evaluate(
    () => document.body.textContent.includes('对讲失败') === false,
  )
  assert('无对讲错误提示', noTalkError)
  await pageB.locator('.talk').dispatchEvent('mouseup')
  await pageB.waitForTimeout(500)

  // ---- 场景 4：控制台无致命错误 ----
  const realErrors = consoleErrors.filter((e) => !e.includes('unload')) // 忽略无害的 unload violation
  assert('页面无控制台错误', realErrors.length === 0)
  if (realErrors.length) console.error('  控制台错误:', realErrors)

  // 截图存证
  fs.mkdirSync('/tmp/e2e', { recursive: true })
  await pageA.screenshot({ path: '/tmp/e2e-camera.png' })
  console.log('  截图: /tmp/e2e-camera.png, /tmp/e2e-viewer.png')
} catch (e) {
  failed++
  console.error(`  ❌ 流程异常: ${e.message}`)
} finally {
  await browser.close()
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed ? 1 : 0)
