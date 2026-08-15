<script setup>
// 检测状态徽标（拍摄端）：三色圆点 + 最近事件列表
import { computed } from 'vue'

const props = defineProps({
  state: { type: String, default: 'calm' }, // calm | moving | crying
  events: { type: Array, default: () => [] },
})

const META = {
  calm: { label: '安静', halo: '' },
  moving: { label: '轻微活动', halo: 'warn' },
  crying: { label: '哭闹', halo: 'alert' },
}

const stateMeta = computed(() => META[props.state] || META.calm)

function fmt(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
</script>

<template>
  <div class="activity glass">
    <div class="now">
      <span class="halo" :class="stateMeta.halo"></span>
      <span class="state-label">{{ stateMeta.label }}</span>
      <div class="now-extra">
        <slot name="extra" />
      </div>
    </div>
    <ul v-if="events.length" class="events">
      <li v-for="(e, i) in events" :key="i" class="muted">
        <span class="num">{{ fmt(e.ts) }}</span>
        <span :class="['evt', e.state]">{{ META[e.state]?.label }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.activity { padding: 12px 16px; }
.now {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
}
.state-label { color: var(--text); }
.now-extra { margin-left: auto; }
.events {
  list-style: none;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 132px;
  overflow-y: auto;
}
.events li {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.evt { font-weight: 600; }
.evt.calm { color: var(--muted); }
.evt.moving { color: var(--warning); }
.evt.crying { color: var(--danger); }
</style>
