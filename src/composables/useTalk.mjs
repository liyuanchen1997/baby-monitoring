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
  let starting = false // gUM 异步期间防重复按下
  let startToken = 0 // press 会话令牌（release 竞态取消用）
  let pendingRelease = false // release 在 press 挂起时到达 → 完成后立即停止

  async function press(pc) {
    if (talking.value || starting) return
    error.value = ''
    starting = true
    const token = ++startToken
    try {
      if (!micStream) {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      }
      const track = micStream.getAudioTracks()[0]
      // 匹配对讲 transceiver：sendrecv/sendonly + 接收端为音频。
      // 不能靠 sender.kind（Safari 未实现）或 sender.track（接收通道为 null）
      const audioTx = pc
        ?.getTransceivers()
        .find(
          (t) =>
            ['sendrecv', 'sendonly'].includes(t.direction) &&
            t.receiver?.track?.kind === 'audio',
        )
      sender = audioTx?.sender ?? null
      if (!sender) throw new Error('未找到音频通道（先建立连接再说话）')
      await sender.replaceTrack(track)
      if (token !== startToken || pendingRelease) {
        // 短按竞态：press 挂起期间 release 已到达 → 立即撤销，不进入说话状态
        pendingRelease = false
        await sender.replaceTrack(null).catch(() => {})
        return
      }
      talking.value = true
    } catch (e) {
      error.value = e.name === 'NotAllowedError' ? '麦克风权限被拒绝' : `对讲失败: ${e.message}`
    } finally {
      starting = false
    }
  }

  async function release() {
    if (talking.value) {
      const s = sender
      sender = null
      talking.value = false
      await s?.replaceTrack(null).catch(() => {})
      return
    }
    if (starting) {
      // press 仍挂起（gUM/授权中）→ 标记取消，press 完成时不会开启麦克风
      pendingRelease = true
    }
  }

  function dispose() {
    micStream?.getTracks().forEach((t) => t.stop())
    micStream = null
    talking.value = false
  }

  return { talking, error, press, release, dispose }
}
