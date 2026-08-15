/**
 * 摄像头采集（拍摄端）
 * - 后置摄像头优先（facingMode environment），PC 无后置则回退默认设备
 * - 720p/24fps（降发热与功耗，长时放置的关键）
 * - 音频开启 AEC/降噪/自动增益（供对讲与哭声检测共用，见设计文档 §7）
 * - flip() 切换前后镜头（重新采集；调用方需重建 PeerConnection）
 */
import { ref } from 'vue'
import { CONFIG } from '../config.js'

const ERR_TEXT = {
  NotAllowedError: '摄像头/麦克风权限被拒绝，请在浏览器设置中允许后重试',
  NotFoundError: '未找到摄像头或麦克风设备',
  NotReadableError: '摄像头被其他应用占用，请关闭后重试',
  OverconstrainedError: '当前设备不支持请求的摄像头参数',
}

export function useCamera() {
  const stream = ref(null)
  const error = ref('')
  const facingMode = ref('environment')
  let currentStream = null

  async function start() {
    stop()
    error.value = ''
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode.value },
          width: CONFIG.video.width,
          height: CONFIG.video.height,
          frameRate: CONFIG.video.frameRate,
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      stream.value = currentStream
    } catch (e) {
      stream.value = null
      error.value = ERR_TEXT[e.name] || `摄像头启动失败: ${e.message}`
    }
  }

  /** 切换前后置（PC 上无实际影响，回退默认） */
  async function flip() {
    facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment'
    await start()
  }

  function stop() {
    currentStream?.getTracks().forEach((t) => t.stop())
    currentStream = null
    stream.value = null
  }

  return { stream, error, facingMode, start, flip, stop }
}
