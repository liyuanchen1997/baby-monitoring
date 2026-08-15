<script setup>
// 连接状态徽标：呼吸光环（夜灯守护设计语言）
// state: disconnected | connecting | connected | reconnecting | failed
const props = defineProps({
  state: { type: String, default: 'disconnected' },
})

const META = {
  disconnected: { label: '未连接', halo: '' },
  connecting: { label: '连接中', halo: 'warn' },
  connected: { label: '已连接', halo: 'live' },
  reconnecting: { label: '重连中', halo: 'warn' },
  failed: { label: '连接失败', halo: 'alert' },
}
</script>

<template>
  <div class="conn">
    <span class="halo" :class="META[props.state]?.halo || ''"></span>
    <span>{{ META[props.state]?.label || props.state }}</span>
  </div>
</template>

<style scoped>
.conn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background: var(--surface-glass);
  border: 1px solid rgba(138, 148, 210, 0.18);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
