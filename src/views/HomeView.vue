<script setup>
import { ref } from 'vue'

const emit = defineEmits(['start-camera', 'join'])
const code = ref('')
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1>👶 宝宝监控</h1>
      <p class="muted">局域网实时监控 · WebRTC 点对点</p>
    </header>

    <main class="home-actions">
      <button class="btn btn-primary btn-lg" @click="emit('start-camera')">
        📹 开始监控
      </button>

      <div class="divider">或</div>

      <form class="join-form" @submit.prevent="code.trim() && emit('join', code.trim())">
        <input
          v-model="code"
          class="code-input"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="输入 6 位房间码"
        />
        <button class="btn btn-secondary btn-lg" type="submit" :disabled="!code.trim()">
          👀 加入房间
        </button>
      </form>
    </main>

    <p class="muted hint">拍摄端：手机或 PC 摄像头。观看端扫码或输入房间码加入。</p>
  </div>
</template>

<style scoped>
.home {
  max-width: 480px;
  margin: 0 auto;
  padding: 48px 24px calc(24px + env(safe-area-inset-bottom));
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.home-header { text-align: center; margin-bottom: 40px; }
.home-header h1 { font-size: 28px; margin: 0 0 8px; }
.home-actions { display: flex; flex-direction: column; gap: 16px; flex: 1; }
.divider { text-align: center; color: var(--muted); font-size: 14px; }
.join-form { display: flex; flex-direction: column; gap: 16px; }
.code-input {
  text-align: center;
  font-size: 24px;
  letter-spacing: 8px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.hint { text-align: center; margin-top: 32px; font-size: 13px; }

/* PC 端（≥1024px）：横向布局，控件更大更疏 */
@media (min-width: 1024px) {
  .home { max-width: 560px; padding-top: 80px; }
  .home-header h1 { font-size: 36px; }
}
</style>
