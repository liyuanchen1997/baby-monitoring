<script setup>
// 观看端视图：加入房间 → 接收拍摄端 offer 应答 → 播放远程画面
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSignaling } from '../composables/useSignaling.mjs'
import { usePeerConnection } from '../composables/usePeerConnection.mjs'
import { useTalk } from '../composables/useTalk.mjs'
import { useScreenshot } from '../composables/useScreenshot.mjs'
import { useRecorder } from '../composables/useRecorder.mjs'
import { useWakeLock } from '../composables/useWakeLock.mjs'
import { CONFIG } from '../config.js'
import ConnectionBadge from '../components/ConnectionBadge.vue'
import ViewerStage from '../components/ViewerStage.vue'
import TalkButton from '../components/TalkButton.vue'

const props = defineProps({
  joinCode: { type: String, default: '' },
})
const emit = defineEmits(['leave'])

const { status: wsStatus, connect, send, on, close } = useSignaling()
const pc = usePeerConnection()
const talk = useTalk()
const screenshot = useScreenshot()
const recorder = useRecorder()
const wakeLock = useWakeLock()

const joined = ref(false)
const joinError = ref('')
const peerState = ref('waiting') // waiting | connected | left
const remoteStream = ref(null)
const stageRef = ref(null)
let retryTimer = null

const errText = {
  'room-not-found': '房间不存在，拍摄端可能尚未开始监控',
  'room-full': '房间已满',
}

let offs = [
  on('room-joined', (m) => {
    if (m.ok) {
      joined.value = true
      joinError.value = ''
      ensurePeer()
    } else {
      joined.value = false
      joinError.value = m.reason
    }
  }),
  on('offer', async (m) => {
    try {
      ensurePeer()
      const answer = await pc.handleOffer(m.sdp)
      send('answer', { sdp: answer.sdp })
    } catch (e) {
      joinError.value = `应答失败: ${e.message}`
    }
  }),
  on('ice', (m) => pc.handleIce(m.candidate)),
  on('peer-left', (m) => {
    if (m.reason === 'camera-left') {
      peerState.value = 'left'
      joined.value = false
      remoteStream.value = null
      pc.close()
    }
  }),
  on('activity', (m) => {
    // 检测状态（模块 7/8 消费）
    console.debug('[activity]', m.state)
  }),
]

/** 创建 PeerConnection：本端只收集 ICE，协商由拍摄端发起 */
function ensurePeer() {
  if (pc.connectionState.value !== 'new' && pc.connectionState.value !== 'closed') return
  pc.create({
    onIceCandidate: (candidate) => send('ice', { candidate }),
    onStateChange: (state) => {
      // failed 且 5s 后拍摄端无动作 → 请求拍摄端重协商
      if (state === 'failed') {
        setTimeout(() => {
          if (pc.connectionState.value === 'failed') send('restart-request')
        }, CONFIG.reconnect.iceDisconnectedMs)
      }
    },
    onTrack: (stream) => {
      remoteStream.value = stream
    },
  })
}

/** AP 隔离提示：WS 正常但 ICE 失败且从未成功连接过 */
const apIsolation = computed(
  () => wsStatus.value === 'connected' && pc.iceState.value === 'failed' && !pc.everConnected.value,
)

function tryJoin() {
  if (wsStatus.value === 'connected' && props.joinCode && !joined.value) {
    send('join-room', { code: props.joinCode })
  }
}

onMounted(() => {
  connect()
  wakeLock.request()
})

watch(wsStatus, (s) => {
  if (s === 'connected') tryJoin()
})

watch(joinError, (e) => {
  clearInterval(retryTimer)
  if (e === 'room-not-found') {
    retryTimer = setInterval(tryJoin, CONFIG.reconnect.joinRetryMs)
    setTimeout(() => clearInterval(retryTimer), CONFIG.reconnect.joinRetryMax)
  }
})

async function onScreenshot() {
  const video = stageRef.value?.video
  const blob = await screenshot.capture(video)
  if (!blob) {
    joinError.value = '画面未就绪，稍后再试'
    return
  }
  screenshot.shareOrDownload(blob, `snapshot-${Date.now()}.png`)
}

async function toggleRecord() {
  const video = stageRef.value?.video
  if (recorder.recording.value) {
    const { blob, ext } = await recorder.stop()
    screenshot.shareOrDownload(blob, `record-${Date.now()}.${ext}`)
    return
  }
  if (!video?.videoWidth) {
    joinError.value = '画面未就绪，稍后再试'
    return
  }
  recorder.start(video)
}

const badgeState = computed(() => {
  if (wsStatus.value === 'disconnected') return 'disconnected'
  if (wsStatus.value === 'connecting') return 'connecting'
  if (pc.connectionState.value === 'connected') return 'connected'
  if (pc.connectionState.value === 'failed' || pc.connectionState.value === 'disconnected') return 'reconnecting'
  return 'connecting'
})

onUnmounted(() => {
  clearInterval(retryTimer)
  offs.forEach((f) => f())
  talk.dispose()
  wakeLock.release()
  pc.close()
  close()
})
</script>

<template>
  <div class="viewer-view">
    <header class="topbar">
      <h1>👀 观看端</h1>
      <ConnectionBadge :state="badgeState" />
    </header>

    <main>
      <ViewerStage v-if="joined && peerState !== 'left'" ref="stageRef" :stream="remoteStream" />
      <p v-if="talk.error.value" class="error small">{{ talk.error.value }}</p>

      <section v-else-if="joinError" class="error-card glass">
        <p class="error">{{ errText[joinError] || joinError }}</p>
        <p v-if="joinError === 'room-not-found'" class="muted">正在等待拍摄端上线，自动重试中…</p>
        <button class="btn btn-primary" @click="tryJoin">重试加入</button>
      </section>

      <section v-else class="error-card glass">
        <p class="muted">{{ wsStatus === 'connected' ? '正在加入房间…' : '正在连接服务器…' }}</p>
      </section>

      <p v-if="apIsolation" class="ap-hint">
        ⚠️ 无法建立点对点直连——路由器可能开启了「AP 隔离/客户端隔离」，
        请关闭该选项或更换网络后重试
      </p>

      <p class="room-info muted num">房间 {{ props.joinCode }}</p>
    </main>

    <footer class="controls glass">
      <button class="btn icon-btn" title="截图" @click="onScreenshot">📸</button>
      <TalkButton
        :talking="talk.talking.value"
        :disabled="!joined || peerState === 'left'"
        @press="talk.press(pc.get())"
        @release="talk.release()"
      />
      <button
        class="btn icon-btn"
        :class="{ recording: recorder.recording.value }"
        :title="recorder.recording.value ? '停止录制' : '录制'"
        @click="toggleRecord"
      >
        {{ recorder.recording.value ? '⏹' : '⏺' }}
      </button>
      <button class="btn icon-btn" title="退出" @click="emit('leave')">✕</button>
    </footer>
  </div>
</template>

<style scoped>
.viewer-view {
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

.error-card {
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.error { color: var(--danger); }

.room-info { text-align: center; font-size: 13px; }

.controls {
  margin-top: auto;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  position: sticky;
  bottom: calc(8px + env(safe-area-inset-bottom));
}
.icon-btn {
  width: 52px;
  height: 52px;
  padding: 0;
  font-size: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}
.recording {
  background: var(--danger);
  color: #2a0a10;
  animation: pulse-alert 1.2s ease-in-out infinite;
}
.error.small { text-align: center; font-size: 13px; margin-top: 8px; }
.ap-hint {
  text-align: center;
  font-size: 13px;
  color: var(--warning);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.25);
}

@media (min-width: 1024px) {
  .viewer-view { max-width: 860px; padding-top: 32px; }
}
</style>
