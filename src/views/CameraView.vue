<script setup>
// 拍摄端视图：建房 → 开始监控（gUM）→ 观看端加入后自动协商推流
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSignaling } from '../composables/useSignaling.mjs'
import { useCamera } from '../composables/useCamera.mjs'
import { usePeerConnection } from '../composables/usePeerConnection.mjs'
import { useWakeLock } from '../composables/useWakeLock.mjs'
import { useActivityMonitor } from '../composables/useActivityMonitor.mjs'
import { CONFIG } from '../config.js'
import ConnectionBadge from '../components/ConnectionBadge.vue'
import CameraPreview from '../components/CameraPreview.vue'
import QrOverlay from '../components/QrOverlay.vue'
import ActivityBadge from '../components/ActivityBadge.vue'
import SensitivityPicker from '../components/SensitivityPicker.vue'

const talkAudio = ref(null) // 隐藏 audio：外放观看端对讲声音
const previewRef = ref(null)
const wakeLock = useWakeLock()
const activity = useActivityMonitor({
  sendActivity: (payload) => send('activity', payload),
})

const { status: wsStatus, connect, send, on, close } = useSignaling()
const camera = useCamera()
const pc = usePeerConnection()

const roomCode = ref('')
const peerJoined = ref(false) // 观看端是否在线
const cameraActive = ref(false) // 摄像头是否已开启
const busy = ref(false) // 协商中，防重入
const error = ref('')
const showQr = ref(false) // 二维码弹层

let offs = [
  on('room-created', (m) => {
    roomCode.value = m.code
    error.value = ''
  }),
  on('peer-joined', () => {
    peerJoined.value = true
    maybeNegotiate()
  }),
  on('peer-left', (m) => {
    if (m.reason === 'viewer-left') {
      peerJoined.value = false
      pc.close()
    }
  }),
  on('answer', (m) => pc.handleAnswer(m.sdp)),
  on('ice', (m) => pc.handleIce(m.candidate)),
  on('restart-request', () => restartAndSendOffer()),
  on('error', (m) => {
    error.value = m.message
  }),
]

// ---- L1 ICE 状态机（拍摄端主导重连，见设计文档 §4）----
let iceTimer = null

function onPcState(state) {
  if (state === 'disconnected') {
    // 容忍短暂断开（WiFi 瞬断可能自动恢复），5s 后仍断则 ICE restart
    clearTimeout(iceTimer)
    iceTimer = setTimeout(() => {
      if (pc.connectionState.value !== 'connected') restartAndSendOffer()
    }, CONFIG.reconnect.iceDisconnectedMs)
  } else if (state === 'failed') {
    clearTimeout(iceTimer)
    rebuildPeer()
  } else {
    clearTimeout(iceTimer)
  }
}

async function restartAndSendOffer() {
  if (busy.value || !cameraActive.value || !peerJoined.value) return
  busy.value = true
  try {
    const offer = await pc.restartIce()
    send('offer', { sdp: offer.sdp })
  } catch {
    // restart 失败（连接已死）→ 整体重建
    pc.close()
    await maybeNegotiate()
  } finally {
    busy.value = false
  }
}

async function rebuildPeer() {
  pc.close()
  await maybeNegotiate()
}

// ---- L2 媒体冻结检测：connected 但画面 >5s 无新帧 → restartIce ----
let lastFrameTs = 0
let mediaWatchTimer = null

function startMediaWatch() {
  const v = previewRef.value?.video
  if (!v?.requestVideoFrameCallback) return
  const tick = (now) => {
    lastFrameTs = now
    v.requestVideoFrameCallback(tick)
  }
  v.requestVideoFrameCallback(tick)
  clearInterval(mediaWatchTimer)
  mediaWatchTimer = setInterval(() => {
    if (
      pc.connectionState.value === 'connected' &&
      lastFrameTs > 0 &&
      performance.now() - lastFrameTs > CONFIG.reconnect.mediaFrozenMs
    ) {
      restartAndSendOffer()
    }
  }, 2000)
}

function stopMediaWatch() {
  clearInterval(mediaWatchTimer)
  lastFrameTs = 0
}

onMounted(() => {
  connect()
  wakeLock.request()
  // 对讲播放期间抑制哭声误报（家长声音经拍摄端外放会被麦克风回采）
  if (talkAudio.value) {
    talkAudio.value.addEventListener('play', () => activity.setTalkActive(true))
    talkAudio.value.addEventListener('pause', () => activity.setTalkActive(false))
  }
})

watch(wsStatus, (s) => {
  if (s === 'connected' && !roomCode.value) send('create-room')
})
// 重连恢复：带原码重建
watch(roomCode, (code) => {
  if (code && wsStatus.value === 'connected') send('create-room', { code })
})

/** 开始监控：采集摄像头 → 若观看端已在线则协商 */
async function startCamera() {
  busy.value = true
  error.value = ''
  await camera.start()
  cameraActive.value = !!camera.stream.value
  if (!cameraActive.value) error.value = camera.error.value || '摄像头启动失败'
  busy.value = false
  if (cameraActive.value) {
    startMediaWatch()
    // 动作/哭声检测（在"开始监控"手势内：iOS 音频解锁）
    activity.start(previewRef.value?.video, camera.stream.value)
  }
  maybeNegotiate()
  // iOS 音频解锁：播放远端对讲流须在用户手势内（"开始监控"点击）
  if (talkAudio.value) {
    talkAudio.value.play().catch(() => {})
  }
}

function stopCamera() {
  camera.stop()
  cameraActive.value = false
  stopMediaWatch()
  activity.stop()
  if (talkAudio.value) talkAudio.value.srcObject = null
  pc.close()
}

async function flipCamera() {
  await camera.flip()
  pc.close() // track 已更换，需重新协商
  maybeNegotiate()
}

/** 协商条件：摄像头就绪 + 观看端在线 + 未在协商 */
async function maybeNegotiate() {
  if (busy.value || !cameraActive.value || !peerJoined.value || !roomCode.value) return
  busy.value = true
  try {
    pc.create({
      onIceCandidate: (candidate) => send('ice', { candidate }),
      onStateChange: onPcState,
      // 远端流 = 观看端对讲声音 → 拍摄端扬声器外放
      onTrack: (stream) => {
        if (talkAudio.value) {
          talkAudio.value.srcObject = stream
          // 对讲期间抑制哭声误报（家长声音经外放回采）
          activity.setTalkActive(!talkAudio.value.paused)
        }
      },
    })
    const offer = await pc.makeOffer(camera.stream.value)
    send('offer', { sdp: offer.sdp })
  } catch (e) {
    error.value = `协商失败: ${e.message}`
  } finally {
    busy.value = false
  }
}

/** 徽标状态归约：WS + PC 两层归约成 5 态 */
const badgeState = computed(() => {
  if (wsStatus.value === 'disconnected') return 'disconnected'
  if (wsStatus.value === 'connecting') return 'connecting'
  if (pc.connectionState.value === 'connected') return 'connected'
  if (pc.connectionState.value === 'failed' || pc.connectionState.value === 'disconnected') return 'reconnecting'
  return 'connecting'
})

onUnmounted(() => {
  clearTimeout(iceTimer)
  stopMediaWatch()
  offs.forEach((f) => f())
  camera.stop()
  activity.stop()
  wakeLock.release()
  pc.close()
  close()
})
</script>

<template>
  <div class="camera-view">
    <header class="topbar">
      <h1>📹 拍摄端</h1>
      <ConnectionBadge :state="badgeState" />
    </header>

    <!-- 房间码：紧凑单行，置于头部下方 -->
    <nav v-if="roomCode" class="room-bar glass">
      <span class="room-label muted">房间码</span>
      <span class="code num">{{ roomCode }}</span>
      <span v-if="peerJoined" class="peer">
        <span class="halo live"></span>已连接
      </span>
      <span v-else class="peer muted">
        <span class="halo warn"></span>等待加入
      </span>
      <button class="btn btn-ghost btn-sm" @click="showQr = true">📱 二维码</button>
    </nav>
    <p v-else class="muted center">正在创建房间…</p>

    <main>
      <CameraPreview ref="previewRef" :stream="camera.stream.value" />

      <template v-if="cameraActive">
        <ActivityBadge :state="activity.state.value" :events="activity.events.value" />
        <SensitivityPicker
          :model-value="activity.sensitivityLevel.value"
          @update:model-value="activity.setSensitivity"
        />
      </template>

      <p v-if="error" class="error">{{ error }}</p>
    </main>

    <!-- 二维码弹层（点击按钮展示） -->
    <teleport to="body">
      <div v-if="showQr" class="qr-modal" @click.self="showQr = false">
        <div class="qr-panel glass">
          <p class="qr-title">扫码进入观看端</p>
          <QrOverlay :code="roomCode" />
          <p v-if="!wakeLock.supported.value" class="wake-hint muted">
            本设备不支持自动常亮，请手动设置永不锁屏
          </p>
          <button class="btn" @click="showQr = false">关闭</button>
        </div>
      </div>
    </teleport>

    <footer class="controls glass">
      <button
        v-if="!cameraActive"
        class="btn btn-primary btn-lg"
        :disabled="busy"
        @click="startCamera"
      >
        📹 开始监控
      </button>
      <template v-else>
        <button class="btn" @click="flipCamera" title="切换前后镜头">🔄 翻转</button>
        <button class="btn btn-danger" @click="stopCamera">⏹ 停止</button>
      </template>
    </footer>

    <!-- 外放观看端对讲声音（隐藏元素，iOS 需手势内 play） -->
    <audio ref="talkAudio" autoplay playsinline class="hidden-audio"></audio>
  </div>
</template>

<style scoped>
.camera-view {
  max-width: 640px;
  margin: 0 auto;
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.topbar h1 { font-size: 20px; }

/* 房间码条：紧凑单行 */
.room-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
}
.room-label { font-size: 13px; }
.code {
  font-size: 30px;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: 0.12em;
  line-height: 1;
}
.peer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ok);
}
.room-bar .btn { margin-left: auto; padding: 8px 14px; font-size: 13px; }

/* 二维码弹层 */
.qr-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(5, 8, 20, 0.7);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.qr-panel {
  padding: 24px 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.qr-title { font-size: 15px; font-weight: 600; }
.wake-hint { font-size: 12px; }

.controls {
  margin-top: auto;
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 14px 16px;
  position: sticky;
  bottom: calc(8px + env(safe-area-inset-bottom));
}
.controls .btn { flex: 1; max-width: 220px; }

.center { text-align: center; margin-top: 16px; }
.error { color: var(--danger); text-align: center; margin-top: 8px; }
.hidden-audio { display: none; }
.wake-hint { margin-top: 8px; font-size: 12px; }

@media (min-width: 1024px) {
  .camera-view { max-width: 760px; padding-top: 32px; }
}
</style>
