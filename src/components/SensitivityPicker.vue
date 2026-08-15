<script setup>
// 检测灵敏度三档（拍摄端设置，localStorage 持久化由 useActivityMonitor 处理）
defineProps({
  modelValue: { type: String, default: 'medium' },
})
const emit = defineEmits(['update:modelValue'])

const LEVELS = [
  { key: 'low', label: '低' },
  { key: 'medium', label: '中' },
  { key: 'high', label: '高' },
]
</script>

<template>
  <div class="picker">
    <span class="muted picker-label">灵敏度</span>
    <div class="seg">
      <button
        v-for="l in LEVELS"
        :key="l.key"
        class="seg-btn"
        :class="{ active: modelValue === l.key }"
        @click="emit('update:modelValue', l.key)"
      >
        {{ l.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  align-items: center;
  gap: 8px;
}
.picker-label { font-size: 12px; }
.seg {
  display: inline-flex;
  background: rgba(11, 16, 38, 0.5);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 2px;
}
.seg-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.seg-btn.active {
  background: var(--primary);
  color: var(--on-primary);
}
</style>
