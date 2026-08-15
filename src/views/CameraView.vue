<script setup>
// 拍摄端视图：建房 → 开始监控（gUM）→ 观看端加入后自动协商推流
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSignaling } from '../composables/useSignaling.mjs'
import { useCamera } from '../composables/useCamera.mjs'
import { usePeerConnection } from '../composables/usePeerConnection.mjs'
import ConnectionBadge from '../components/ConnectionBadge.vue'
import CameraPreview from '../components/CameraPreview.vue'

const { status: wsStatus, connect, send, on, close } = useSignaling()
const camera = useCamera()
const pc = usePeerConnection()

const roomCode = ref('')
const peerJoined = ref(false) // 观看端是否在线
const cameraActive = ref(false) // 摄像头是否已开启
const busy = ref(false) // 协商中，防重入
const error = ref('')

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
  on('error', (m) => {
    error.value = m.message
  }),
]

onMounted(() => connect())

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
  maybeNegotiate()
}

function stopCamera() {
  camera.stop()
  cameraActive.value = false
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
  offs.forEach((f) => f())
  camera.stop()
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

    <main>
      <CameraPreview :stream="camera.stream.value" />

      <section v-if="roomCode" class="room-card glass">
        <p class="label">房间码</p>
        <p class="code num">{{ roomCode }}</p>
        <p v-if="peerJoined" class="peer-line">
          <span class="halo live"></span> 观看端已连接
        </p>
        <p v-else class="peer-line muted">等待观看端加入…</p>
      </section>
      <p v-else class="muted center">正在创建房间…</p>

      <p v-if="error" class="error">{{ error }}</p>
    </main>

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

.room-card {
  padding: 16px;
  text-align: center;
}
.label { font-size: 13px; color: var(--muted); }
.code {
  font-size: 52px;
  font-weight: 700;
  color: var(--primary);
  text-shadow: var(--glow-amber);
  line-height: 1.2;
  margin: 4px 0 8px;
}
.peer-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ok);
}

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

@media (min-width: 1024px) {
  .camera-view { max-width: 760px; padding-top: 32px; }
  .code { font-size: 64px; }
}
</style>
