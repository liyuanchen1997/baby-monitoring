<script setup>
// 视图分发：URL ?join=<code> 直接进入观看模式（扫码/分享链接场景）；
// 否则进入首页由用户选择「开始监控」或「加入房间」。
// 不用 vue-router，避免多余依赖。
import { ref, onMounted } from 'vue'
import HomeView from './views/HomeView.vue'
import CameraView from './views/CameraView.vue'
import ViewerView from './views/ViewerView.vue'

const mode = ref('home') // 'home' | 'camera' | 'viewer'
const joinCode = ref(new URLSearchParams(location.search).get('join') ?? '')

onMounted(() => {
  if (joinCode.value) mode.value = 'viewer'
})

function startCamera() {
  mode.value = 'camera'
}

function join(code) {
  joinCode.value = code
  mode.value = 'viewer'
}
</script>

<template>
  <HomeView v-if="mode === 'home'" @start-camera="startCamera" @join="join" />
  <CameraView v-else-if="mode === 'camera'" />
  <ViewerView v-else :join-code="joinCode" @leave="mode = 'home'" />
</template>
