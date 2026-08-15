<script setup>
// 按住说话按钮（对讲机式）：触屏 + 鼠标双事件，按住激活/松开熄灭
import { computed } from 'vue'

const props = defineProps({
  talking: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['press', 'release'])

const pressed = computed(() => props.talking)
</script>

<template>
  <button
    class="talk"
    :class="{ active: pressed, disabled }"
    :disabled="disabled"
    @touchstart.prevent="emit('press')"
    @touchend.prevent="emit('release')"
    @touchcancel.prevent="emit('release')"
    @mousedown.prevent="emit('press')"
    @mouseup.prevent="emit('release')"
    @mouseleave.prevent="emit('release')"
  >
    <span class="mic">{{ pressed ? '🔊' : '🎙' }}</span>
    <span class="txt">{{ pressed ? '松开停止' : '按住说话' }}</span>
  </button>
</template>

<style scoped>
.talk {
  flex: 1.4; /* 视觉主按钮，比其他控制按钮宽 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 12px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  touch-action: none; /* 防止按住时页面滚动/缩放手势 */
  user-select: none;
  -webkit-user-select: none;
  transition: background 0.15s, color 0.15s, box-shadow 0.2s, transform 0.06s;
}
.talk:active { transform: scale(0.97); }
.talk.active {
  background: var(--primary);
  border-color: transparent;
  color: var(--on-primary);
  box-shadow: var(--glow-amber);
}
.talk.disabled { opacity: 0.4; cursor: not-allowed; }
.mic { font-size: 22px; line-height: 1; }
.txt { font-size: 13px; font-weight: 600; }
</style>
