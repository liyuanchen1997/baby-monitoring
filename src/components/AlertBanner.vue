<script setup>
// 告警横幅（观看端）：状态驱动，哭闹红 / 活动黄
import { computed } from 'vue'
import { ACTIVITY_META } from '../utils/activityMeta.mjs'

const props = defineProps({
  banner: { type: Object, default: null }, // { level: 'moving'|'crying', ts }
})

const meta = computed(() =>
  props.banner ? ACTIVITY_META[props.banner.level] || ACTIVITY_META.moving : null,
)
</script>

<template>
  <transition name="slide">
    <div v-if="meta" class="alert" :class="meta.cls">
      <span class="halo" :class="props.banner.level === 'crying' ? 'alert' : 'warn'"></span>
      <span class="text">{{ meta.text }}</span>
    </div>
  </transition>
</template>

<style scoped>
.alert {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: var(--radius-lg);
  font-weight: 700;
  font-size: 16px;
  margin: 8px 0;
}
.alert.moving {
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.4);
  color: var(--warning);
}
.alert.crying {
  background: rgba(251, 113, 133, 0.15);
  border: 1px solid rgba(251, 113, 133, 0.5);
  color: var(--danger);
  box-shadow: var(--glow-red);
}
.slide-enter-active { transition: all 0.25s ease; }
.slide-leave-active { transition: all 0.25s ease; }
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
