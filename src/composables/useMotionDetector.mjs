/**
 * 动作检测器（拍摄端）：帧间差分 + 网格统计
 * - 4fps 采样（250ms），document.hidden 时跳过（省电）
 * - 连续 N 帧有动作 → onActive；连续 N 帧无动作 → onQuiet
 * - 前 3s 预热忽略（亮度跳变）；光照事件（均匀大面积变化）不计入
 */
import { createFrameDiff } from '../utils/frameDiff.mjs'
import { CONFIG } from '../config.js'

const { sampleMs: SAMPLE_MS, warmupFrames: WARMUP_FRAMES } = CONFIG.detection

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
    lastTime = -1 // 重置冻结状态（避免重建后用上一会话的陈旧时间戳误判）
    frozenCycles = 0
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
      // 不等于"宝宝安静"——冻结帧立即跳过（不 analyze、不累计任何 streak），
      // 避免 off-by-N：冻结的前几帧若落入差分逻辑会因画面相同误报安静
      if (video.currentTime === lastTime) {
        frozenCycles++
        return
      }
      lastTime = video.currentTime
      frozenCycles = 0
      const r = diff.analyze(video)
      if (r.first) return
      if (warmup > 0) {
        warmup--
        return
      }
      // 光照事件（均匀大面积变化）是中性帧：不累计 active 也不累计 quiet，
      // 否则窗帘/阴影持续变化会误报"安静"并掩盖期间的真实运动
      if (r.isLightChange) return
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
