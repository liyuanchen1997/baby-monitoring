<script setup>
// 拍摄端本地回显：muted 防啸叫；圆角 16:9 画面
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  stream: { type: MediaStream, default: null },
})

const video = ref(null)

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

// 供父组件媒体冻结检测（L2 重连）访问 video
defineExpose({ video })
</script>

<template>
  <div class="preview glass">
    <video v-show="stream" ref="video" autoplay muted playsinline></video>
    <div v-if="!stream" class="placeholder">
      <span class="muted">摄像头未启动</span>
    </div>
  </div>
</template>

<style scoped>
.preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: #060a1c;
}
video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* 监控画面铺满，无黑边 */
}
.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
