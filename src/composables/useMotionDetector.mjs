/**
 * 动作检测器（拍摄端）：帧间差分 + 网格统计
 * - 4fps 采样（250ms），document.hidden 时跳过（省电）
 * - 连续 N 帧有动作 → onActive；连续 N 帧无动作 → onQuiet
 * - 前 3s 预热忽略（亮度跳变）；光照事件（均匀大面积变化）不计入
 */
import { createFrameDiff } from '../utils/frameDiff.mjs'

const SAMPLE_MS = 250
const WARMUP_FRAMES = 12 // 3s @ 4fps

export function useMotionDetector() {
  let timer = null
  let diff = null
  let cfg = null
  let warmup = 0
  let activeStreak = 0
  let quietStreak = 0
  let onActive = null
  let onQuiet = null
  let lastTime = -1
  let frozenCycles = 0

  function rebuild() {
    diff = createFrameDiff({
      diffThreshold: cfg.diffThreshold,
      changedCellsMin: cfg.changedCells,
    })
    warmup = WARMUP_FRAMES
    activeStreak = 0
    quietStreak = 0
  }

  function start(video, sensitivity, handlers) {
    stop()
    cfg = sensitivity
    onActive = handlers.onActive
    onQuiet = handlers.onQuiet
    rebuild()
    timer = setInterval(() => {
      if (document.hidden || !video?.videoWidth) return
      // 帧冻结保护：视频出帧停止（后台 tab / 摄像头故障）时画面静止，
      // 不等于"宝宝安静"——跳过采样且不累计判定，保持当前状态
      if (video.currentTime === lastTime) {
        frozenCycles++
        if (frozenCycles >= 4) return // 1s 无新帧 → 冻结
      } else {
        lastTime = video.currentTime
        frozenCycles = 0
      }
      const r = diff.analyze(video)
      if (r.first) return
      if (warmup > 0) {
        warmup--
        return
      }
      if (r.isMotion) {
        activeStreak++
        quietStreak = 0
        if (activeStreak === cfg.frames) onActive?.()
      } else {
        quietStreak++
        activeStreak = 0
        if (quietStreak === cfg.frames) onQuiet?.()
      }
    }, SAMPLE_MS)
  }

  /** 灵敏度切换即时生效（重建差分器，重置连续计数） */
  function setSensitivity(sensitivity) {
    if (!cfg) return
    cfg = sensitivity
    rebuild()
  }

  function stop() {
    clearInterval(timer)
    timer = null
    diff = null
  }

  return { start, setSensitivity, stop }
}
