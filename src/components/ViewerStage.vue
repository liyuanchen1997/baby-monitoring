<script setup>
// 观看端远程画面
// iOS 自动播放策略：muted+autoplay 先播；首帧后尝试解锁声音，
// 被浏览器拒绝则显示「点击开启声音」遮罩（点按即用户手势，解锁后关闭）。
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  stream: { type: MediaStream, default: null },
})

const video = ref(null)
const soundLocked = ref(false)
const hasVideo = ref(false)

onMounted(() => {
  if (video.value && props.stream) video.value.srcObject = props.stream
})

watch(
  () => props.stream,
  (s) => {
    if (video.value) video.value.srcObject = s
  },
  { flush: 'post' },
)

async function tryUnlock() {
  if (!video.value) return
  video.value.muted = false
  try {
    await video.value.play()
    soundLocked.value = false
  } catch {
    soundLocked.value = true // 无手势，保持遮罩等待点按
  }
}

function onMeta() {
  hasVideo.value = true
  tryUnlock()
}
</script>

<template>
  <div class="stage glass" @click="soundLocked && tryUnlock()">
    <video
      v-show="hasVideo && stream"
      ref="video"
      autoplay
      muted
      playsinline
      @loadedmetadata="onMeta"
    ></video>

    <div v-if="!hasVideo || !stream" class="placeholder">
      <span class="halo warn"></span>
      <span class="muted">等待拍摄端画面…</span>
    </div>

    <button v-if="soundLocked && hasVideo" class="unlock btn btn-primary">
      🔊 点击开启声音
    </button>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: #060a1c;
  cursor: pointer;
}
video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.unlock {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}
</style>
