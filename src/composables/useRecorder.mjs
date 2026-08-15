/**
 * 录制（观看端）：全平台统一 canvas 兜底路径
 *
 * 为什么不用直录远程流：iOS Safari 对合成器渲染的远端帧直录会黑屏（已知 bug），
 * 统一走 canvas 路径一条代码覆盖全平台（iPhone 可承受开销，设计文档 §9）。
 *
 * 流程：rAF 循环 drawImage 远程视频帧到隐藏 canvas → captureStream(30)
 *      + 拼接远端音频 track → MediaRecorder → mp4(avc1)/webm(vp8) Blob
 */
import { ref } from 'vue'

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // iOS Safari
  'video/webm;codecs=vp8,opus', // Android Chrome / 桌面
  'video/webm',
]

export function useRecorder() {
  const recording = ref(false)
  const supported = typeof MediaRecorder !== 'undefined'

  let recorder = null
  let rafId = 0
  let canvas = null
  let canvasCtx = null
  let canvasStream = null
  let chunks = []
  let ext = 'webm'

  function pickMimeType() {
    return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || ''
  }

  function start(video) {
    if (recording.value) return
    canvas = document.createElement('canvas')
    canvasCtx = canvas.getContext('2d')

    const draw = () => {
      if (video?.videoWidth) {
        // 尺寸跟随视频（首帧后稳定；防 rAF 期间重复改尺寸的抖动）
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        canvasCtx.drawImage(video, 0, 0)
      }
      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    canvasStream = canvas.captureStream(30)
    // 拼接远端音频（track 可被多 stream 复用；录制流独立，不影响原播放）
    for (const t of video?.srcObject?.getAudioTracks?.() ?? []) {
      canvasStream.addTrack(t)
    }

    const mimeType = pickMimeType()
    ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
    recorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined)
    chunks = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    recorder.start(1000) // timeslice：修 Chrome webm duration 显示错误
    recording.value = true
  }

  function stop() {
    return new Promise((resolve) => {
      recorder.onstop = () => {
        cancelAnimationFrame(rafId)
        const blob = new Blob(chunks, { type: recorder.mimeType })
        // 只停录制流自带的 video track；远程 audio track 不动（还在播放）
        canvasStream.getVideoTracks().forEach((t) => t.stop())
        recorder = null
        recording.value = false
        resolve({ blob, ext })
      }
      recorder.stop()
    })
  }

  return { recording, supported, start, stop }
}
