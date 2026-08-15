<script setup>
/**
 * 二维码配对：拍摄端展示观看端入口 URL
 * 内容 = `${protocol}//${lanIp}:${port}/?join=<房间码>`
 * lanIp 来自 /api/info —— 拍摄端即使经 localhost 打开，二维码也指向局域网 IP
 * 扫码 → 手机浏览器打开 → HomeView 自动识别 ?join= 预填 → 一键加入
 */
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps({
  code: { type: String, default: '' },
})

const canvas = ref(null)
const qrUrl = ref('')
const qrError = ref('')
const lanIp = ref('')

async function fetchLanIp() {
  try {
    const res = await fetch('/api/info')
    if (!res.ok) return
    const data = await res.json()
    lanIp.value = data.lanIp || ''
  } catch {
    // 网络异常降级：使用当前 hostname（localhost 场景则无法扫码，仅展示）
  }
}

async function render() {
  if (!props.code || !canvas.value) return
  const host = lanIp.value || location.hostname
  qrUrl.value = `${location.protocol}//${host}:${location.port}/?join=${props.code}`
  try {
    await QRCode.toCanvas(canvas.value, qrUrl.value, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1026', light: '#ffffff' }, // 深蓝模块 + 白底，经典高对比
    })
    qrError.value = ''
  } catch (e) {
    qrError.value = `二维码生成失败: ${e.message}`
  }
}

onMounted(async () => {
  await fetchLanIp()
  render()
})

watch(() => props.code, render)
</script>

<template>
  <div class="qr">
    <div class="qr-box glass">
      <canvas ref="canvas"></canvas>
      <p v-if="qrError" class="qr-error">{{ qrError }}</p>
      <p v-else class="muted">扫码进入观看端</p>
    </div>
    <p class="qr-url muted">{{ qrUrl }}</p>
  </div>
</template>

<style scoped>
.qr { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.qr-box {
  padding: 14px;
  background: #fff; /* 二维码白底保证识别率，玻璃边框外圈 */
  border-radius: var(--radius-md);
}
canvas { display: block; width: 200px; height: 200px; }
.qr-url {
  font-family: var(--font-num);
  font-size: 12px;
  word-break: break-all;
  text-align: center;
  max-width: 320px;
}
.qr-error { color: var(--danger); font-size: 13px; }
</style>
