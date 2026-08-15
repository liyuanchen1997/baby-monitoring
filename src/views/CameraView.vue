<script setup>
// 拍摄端视图：建房 → 显示房间码 → 等待观看端加入 → 媒体链路（模块 3）接入
import { ref, watch, onUnmounted } from 'vue'
import { useSignaling } from '../composables/useSignaling.mjs'

const { status, connect, send, on, close } = useSignaling()
const roomCode = ref('')
const peerState = ref('waiting') // waiting | connected | left
const error = ref('')

let offs = [
  on('room-created', (m) => {
    roomCode.value = m.code
    error.value = ''
  }),
  on('peer-joined', () => {
    peerState.value = 'connected'
  }),
  on('peer-left', (m) => {
    peerState.value = m.reason === 'viewer-left' ? 'waiting' : 'left'
  }),
  on('error', (m) => {
    error.value = m.message
  }),
]

// 连接就绪后自动建房
watch(status, (s) => {
  if (s === 'connected' && !roomCode.value) send('create-room')
})

// 重连恢复：带原码重建房间（服务器会复用同码房间）
watch(roomCode, (code) => {
  if (code && status.value === 'connected') send('create-room', { code })
})

onUnmounted(() => {
  offs.forEach((f) => f())
  close()
})
</script>

<template>
  <div class="camera-view">
    <header>
      <h1>📹 拍摄端</h1>
      <p class="muted">连接状态：{{ status }}</p>
    </header>

    <main>
      <template v-if="roomCode">
        <div class="room-code">
          <span class="label">房间码</span>
          <span class="code">{{ roomCode }}</span>
        </div>

        <div class="status-line">
          <span v-if="peerState === 'connected'" class="badge ok">观看端已加入</span>
          <span v-else-if="peerState === 'left'" class="badge danger">连接已断开</span>
          <span v-else class="badge muted">等待观看端加入…</span>
        </div>

        <p class="muted placeholder">🔌 摄像头与媒体推流将在模块 3 接入</p>
      </template>

      <p v-else class="muted">{{ status === 'connected' ? '正在创建房间…' : '正在连接服务器…' }}</p>

      <p v-if="error" class="error">错误：{{ error }}</p>
    </main>
  </div>
</template>

<style scoped>
.camera-view {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 24px calc(24px + env(safe-area-inset-bottom));
  text-align: center;
}
header { margin-bottom: 32px; }
.room-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 24px 0;
}
.code {
  font-size: 56px;
  font-weight: 700;
  letter-spacing: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--primary);
}
.label { font-size: 14px; color: var(--muted); }
.status-line { margin: 16px 0; }
.badge {
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
}
.badge.ok { background: rgba(52, 211, 153, 0.15); color: var(--ok); }
.badge.danger { background: rgba(248, 113, 113, 0.15); color: var(--danger); }
.badge.muted { background: rgba(148, 163, 184, 0.15); color: var(--muted); }
.placeholder { margin-top: 32px; }
.error { color: var(--danger); margin-top: 16px; }

@media (min-width: 1024px) {
  .camera-view { max-width: 640px; padding-top: 64px; }
  .code { font-size: 72px; }
}
</style>
