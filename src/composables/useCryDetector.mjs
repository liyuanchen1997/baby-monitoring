/**
 * 哭声检测器（拍摄端，Web Audio 启发式）
 * 每 100ms 一帧分析：
 * 1. 频带能量 300-3000Hz（float 优先，byte 降级——两者刻度已统一为 dB 归一化）
 * 2. 自适应噪声底（60s 窗低分位 EMA）——窗帘/空调声自动学成正常；
 *    哭声激活时暂停学习（防持续哭声抬高基线导致检测停止）
 * 3. voicedness（100-600Hz 归一化自相关）——哭声周期性发声 vs 白噪平坦
 * 4. 达标窗口：cryWindowMs 内 ≥70% 帧达标且最大空隙 ≤300ms → onCry
 * 5. 连续 5s 不达标 → onQuiet（达标帧不累计，防持续哭闹振荡）
 * 对讲时 talkActive：阈值临时 +6dB
 */
import { bandEnergy, voicedness, NoiseFloor } from '../utils/audio.mjs'
import { CONFIG } from '../config.js'

const { analyzeMs: ANALYZE_MS, cryQuietStreak: QUIET_STREAK, voiceThreshold: VOICE_THRESHOLD, maxGapFrames: MAX_GAP_FRAMES } = CONFIG.detection

export function useCryDetector() {
  let audioCtx = null
  let analyser = null
  let freqData = null
  let timeData = null
  let byteFreqData = null
  let byteTimeData = null
  let timer = null
  let noiseFloor = null
  let cfg = null
  let passHistory = []
  let quietStreak = 0
  let talkBoost = false
  let onCry = null
  let onQuiet = null
  let cryActive = false

  async function start(stream, sensitivity, handlers) {
    stop()
    cfg = sensitivity
    onCry = handlers.onCry
    onQuiet = handlers.onQuiet
    noiseFloor = new NoiseFloor()
    passHistory = []
    quietStreak = 0
    cryActive = false

    // iOS 需手势解锁；resume 失败（手势窗口失效）不抛未处理 rejection，降级继续
    audioCtx = new AudioContext()
    const ctx = audioCtx // 捕获本次会话引用（stop 竞态防护）
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        // 静默降级：可能无法分析（iOS 手势窗口失效场景）
      }
    }
    if (audioCtx !== ctx || ctx.state !== 'running') {
      // 本会话挂起期间 stop() 已调用 → 放弃初始化
      ctx.close().catch(() => {})
      return
    }
    const src = ctx.createMediaStreamSource(stream)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 512 // 300-3000Hz 与 lag≤200 均覆盖（2048 多余，省 CPU）
    analyser.smoothingTimeConstant = 0.3
    src.connect(analyser)
    freqData = new Float32Array(analyser.frequencyBinCount)
    timeData = new Float32Array(analyser.fftSize)
    byteFreqData = new Uint8Array(analyser.frequencyBinCount)
    byteTimeData = new Uint8Array(analyser.fftSize)

    timer = setInterval(analyze, ANALYZE_MS)
  }

  function analyze() {
    if (!analyser) return // stop 后残留 tick 防护
    if (document.hidden) return // 页面隐藏/锁屏：停止分析省电（与动作检测对齐）

    // 频带能量（float 优先，byte 降级——刻度已统一）
    let energy
    const useFloat = typeof analyser.getFloatFrequencyData === 'function'
    if (useFloat) {
      analyser.getFloatFrequencyData(freqData)
      energy = bandEnergy(analyser, freqData, 300, 3000)
    } else {
      analyser.getByteFrequencyData(byteFreqData)
      energy = bandEnergy(analyser, byteFreqData, 300, 3000)
    }

    const floor = noiseFloor.update(energy)
    if (noiseFloor.isWarming()) return // 噪声底预热期不判定

    // 周期性（float 优先，byte 时域降级；均不支持则判无声——宁漏报不误报）
    let voice = 0
    if (useFloat && typeof analyser.getFloatTimeDomainData === 'function') {
      analyser.getFloatTimeDomainData(timeData)
      voice = voicedness(timeData, audioCtx.sampleRate)
    } else if (typeof analyser.getByteTimeDomainData === 'function') {
      analyser.getByteTimeDomainData(byteTimeData)
      for (let i = 0; i < byteTimeData.length; i++) timeData[i] = (byteTimeData[i] - 128) / 128
      voice = voicedness(timeData, audioCtx.sampleRate)
    }

    // 达标判定：能量高于噪声底（对讲时 +6dB）+ 声音有周期性
    const threshold = (cfg.cryDb + (talkBoost ? 6 : 0)) / 100
    const pass = energy - floor > threshold && voice > VOICE_THRESHOLD

    // 滚动窗口
    const windowFrames = Math.round(cfg.cryWindowMs / ANALYZE_MS)
    passHistory.push(pass)
    if (passHistory.length > windowFrames) passHistory.shift()

    const windowFull = passHistory.length >= windowFrames
    const passRatio = passHistory.filter(Boolean).length / passHistory.length
    let maxGap = 0
    let gap = 0
    for (const p of passHistory) {
      if (p) {
        maxGap = Math.max(maxGap, gap)
        gap = 0
      } else {
        gap++
      }
    }
    maxGap = Math.max(maxGap, gap)

    const windowPass = windowFull && passRatio >= 0.7 && maxGap <= MAX_GAP_FRAMES

    if (windowPass && !cryActive) {
      cryActive = true
      quietStreak = 0
      noiseFloor.setLearning(false) // 哭声激活：暂停基线学习（防持续哭声抬高基线）
      onCry?.()
    } else if (cryActive) {
      if (windowPass) {
        // 持续达标：重置安静计数（达标帧不得累计，否则持续哭闹每 5s 误报一次安静）
        quietStreak = 0
      } else {
        quietStreak++
        if (quietStreak >= QUIET_STREAK) {
          cryActive = false
          noiseFloor.setLearning(true)
          onQuiet?.()
        }
      }
    }
  }

  /** 对讲激活：家长声音经拍摄端外放时抑制误报（阈值 +6dB） */
  function setTalkActive(v) {
    talkBoost = v
  }

  function setSensitivity(sensitivity) {
    if (!cfg) return
    cfg = sensitivity
    passHistory = [] // 重置窗口（灵敏度切换即时生效）
  }

  function stop() {
    clearInterval(timer)
    timer = null
    audioCtx?.close().catch(() => {})
    audioCtx = null
    analyser = null
  }

  return { start, setTalkActive, setSensitivity, stop }
}
