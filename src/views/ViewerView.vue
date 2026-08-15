<script setup>
// 观看端视图：远程画面、对讲、截图/录制、告警提醒
// 媒体链路（模块 3）、对讲/截图/录制（模块 4）、提醒（模块 8）落地于此
const props = defineProps({
  joinCode: { type: String, default: '' },
})
</script>

<template>
  <div class="viewer-view">
    <h1>👀 观看端</h1>
    <p class="muted">房间码：{{ props.joinCode || '未填写' }}</p>
    <p class="muted">模块 3（媒体链路）实现后接入远程画面</p>
  </div>
</template>

<style scoped>
.viewer-view { padding: 48px 24px; text-align: center; }
</style>
