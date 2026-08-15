<script setup>
// 观看端视图：加入房间 → 接收拍摄端 offer 应答 → 播放远程画面
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSignaling } from '../composables/useSignaling.mjs'
import { usePeerConnection } from '../composables/usePeerConnection.mjs'
import { CONFIG } from '../config.js'
import ConnectionBadge from '../components/ConnectionBadge.vue'
import ViewerStage from '../components/ViewerStage.vue'

const props = defineProps({
  joinCode: { type: String, default: '' },
})
const emit = defineEmits(['leave'])

const { status: wsStatus, connect, send, on, close } = useSignaling()
const pc = usePeerConnection()

const joined = ref(false)
const joinError = ref('')
const peerState = ref('waiting') // waiting | connected | left
const remoteStream = ref(null)
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
    onTrack: (stream) => {
      remoteStream.value = stream
    },
  })
}

function tryJoin() {
  if (wsStatus.value === 'connected' && props.joinCode && !joined.value) {
    send('join-room', { code: props.joinCode })
  }
}

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
      <ViewerStage v-if="joined && peerState !== 'left'" :stream="remoteStream" />

      <section v-else-if="joinError" class="error-card glass">
        <p class="error">{{ errText[joinError] || joinError }}</p>
        <p v-if="joinError === 'room-not-found'" class="muted">正在等待拍摄端上线，自动重试中…</p>
        <button class="btn btn-primary" @click="tryJoin">重试加入</button>
      </section>

      <section v-else class="error-card glass">
        <p class="muted">{{ wsStatus === 'connected' ? '正在加入房间…' : '正在连接服务器…' }}</p>
      </section>

      <p class="room-info muted num">房间 {{ props.joinCode }}</p>
    </main>

    <footer class="controls glass">
      <button class="btn" @click="emit('leave')">退出</button>
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
  gap: 12px;
  justify-content: center;
  padding: 14px 16px;
  position: sticky;
  bottom: calc(8px + env(safe-area-inset-bottom));
}
.controls .btn { flex: 1; max-width: 220px; }

@media (min-width: 1024px) {
  .viewer-view { max-width: 860px; padding-top: 32px; }
}
</style>
