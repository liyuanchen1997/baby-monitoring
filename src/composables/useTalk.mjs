/**
 * 按住说话（观看端 → 拍摄端）
 * - 按下：首次按需 gUM 麦克风（手势内申请权限），replaceTrack 到 PC 音频 sender
 * - 松开：replaceTrack(null) 停止发送（麦克风轨道保留复用，不重新采集）
 * - 复用模块 3 预留的 audio transceiver（sendrecv），全程不重新协商
 */
import { ref } from 'vue'

export function useTalk() {
  const talking = ref(false)
  const error = ref('')
  let micStream = null
  let sender = null

  async function press(pc) {
    if (talking.value) return
    error.value = ''
    try {
      if (!micStream) {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      }
      const track = micStream.getAudioTracks()[0]
      sender = pc?.getSenders().find((s) => s.track?.kind === 'audio') ?? null
      if (!sender) throw new Error('未找到音频通道（先建立连接再说话）')
      await sender.replaceTrack(track)
      talking.value = true
    } catch (e) {
      error.value = e.name === 'NotAllowedError' ? '麦克风权限被拒绝' : `对讲失败: ${e.message}`
    }
  }

  async function release() {
    if (!talking.value) return
    try {
      await sender?.replaceTrack(null)
    } finally {
      talking.value = false
    }
  }

  function dispose() {
    micStream?.getTracks().forEach((t) => t.stop())
    micStream = null
    talking.value = false
  }

  return { talking, error, press, release, dispose }
}
