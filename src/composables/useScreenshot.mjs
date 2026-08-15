/**
 * 截图（观看端）：canvas 截取远程视频帧 → PNG
 * - 远程 WebRTC 流不污染 canvas（不同于跨域图片），toBlob 可直接用
 * - 优先 navigator.share 分享（iOS 对 a.download 支持差），失败/不支持走下载
 */
export function useScreenshot() {
  /** 截取 video 当前帧，返回 PNG Blob（无画面返回 null） */
  function capture(video) {
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
  }

  /** 分享优先，下载兜底 */
  async function shareOrDownload(blob, filename) {
    const file = new File([blob], filename, { type: blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename })
        return
      } catch {
        // 用户取消分享 → 走下载兜底
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  return { capture, shareOrDownload }
}
