<script setup>
// 观看端视图：加入房间 → 等待拍摄端 → 媒体链路（模块 3）接入
import { ref, watch, onUnmounted } from 'vue'
import { useSignaling } from '../composables/useSignaling.mjs'
import { CONFIG } from '../config.js'

const props = defineProps({
  joinCode: { type: String, default: '' },
})

const { status, connect, send, on, close } = useSignaling()
const joined = ref(false)
const joinError = ref('') // '' | 'room-not-found' | 'room-full' | 其他
const peerState = ref('waiting') // waiting | connected | left
let retryTimer = null

const errText = {
  'room-not-found': '房间不存在（拍摄端可能尚未开始监控）',
  'room-full': '房间已满',
}

let offs = [
  on('room-joined', (m) => {
    if (m.ok) {
      joined.value = true
      joinError.value = ''
    } else {
      joined.value = false
      joinError.value = m.reason
    }
  }),
  on('peer-left', (m) => {
    if (m.reason === 'camera-left') {
      peerState.value = 'left'
      joined.value = false
    }
  }),
  on('activity', (m) => {
    // 检测状态（模块 7/8 消费），模块 2 仅透传可用
    console.debug('[activity]', m.state)
  }),
]

// 连接就绪后加入；房间不存在则自动重试（等待拍摄端恢复）
function tryJoin() {
  if (status.value === 'connected' && props.joinCode && !joined.value) {
    send('join-room', { code: props.joinCode })
  }
}

watch(status, (s) => {
  if (s === 'connected') {
    tryJoin()
    if (joinError.value === 'room-not-found') {
      clearInterval(retryTimer)
      retryTimer = setInterval(tryJoin, CONFIG.reconnect.joinRetryMs)
      setTimeout(() => clearInterval(retryTimer), CONFIG.reconnect.joinRetryMax)
    }
  }
})

watch(joinError, (e) => {
  if (e === 'room-not-found') {
    clearInterval(retryTimer)
    retryTimer = setInterval(tryJoin, CONFIG.reconnect.joinRetryMs)
    setTimeout(() => clearInterval(retryTimer), CONFIG.reconnect.joinRetryMax)
  } else {
    clearInterval(retryTimer)
  }
})

onUnmounted(() => {
  clearInterval(retryTimer)
  offs.forEach((f) => f())
  close()
})
</script>

<template>
  <div class="viewer-view">
    <header>
      <h1>👀 观看端</h1>
      <p class="muted">连接状态：{{ status }}</p>
    </header>

    <main>
      <template v-if="joined">
        <div class="status-line">
          <span v-if="peerState === 'connected'" class="badge ok">已连接拍摄端</span>
          <span v-else class="badge muted">等待拍摄端画面…</span>
        </div>
        <p class="muted room-info">房间：{{ props.joinCode }}</p>
        <p class="muted placeholder">🔌 视频画面与对讲将在模块 3 接入</p>
      </template>

      <template v-else-if="joinError">
        <p class="error">{{ errText[joinError] || joinError }}</p>
        <p v-if="joinError === 'room-not-found'" class="muted">正在等待拍摄端上线并自动重试…</p>
        <button class="btn btn-primary" @click="tryJoin">重试加入</button>
      </template>

      <p v-else class="muted">{{ status === 'connected' ? '正在加入房间…' : '正在连接服务器…' }}</p>
    </main>
  </div>
</template>

<style scoped>
.viewer-view {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 24px calc(24px + env(safe-area-inset-bottom));
  text-align: center;
}
header { margin-bottom: 32px; }
.status-line { margin: 16px 0; }
.badge {
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
}
.badge.ok { background: rgba(52, 211, 153, 0.15); color: var(--ok); }
.badge.muted { background: rgba(148, 163, 184, 0.15); color: var(--muted); }
.room-info { margin: 8px 0; }
.placeholder { margin-top: 32px; }
.error { color: var(--danger); margin: 16px 0; }
</style>
