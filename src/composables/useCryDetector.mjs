/**
 * 哭声检测器（拍摄端，Web Audio 启发式）
 * 每 100ms 一帧分析：
 * 1. 频带能量 300-3000Hz（getFloatFrequencyData，Safari 降级 byte）
 * 2. 自适应噪声底（60s 窗低分位 EMA）——窗帘/空调声自动学成正常
 * 3. voicedness（100-600Hz 归一化自相关）——哭声周期性发声 vs 白噪平坦
 * 4. 达标窗口：cryWindowMs 内 ≥70% 帧达标且最大空隙 ≤300ms → onCry
 * 5. 连续 5s 不达标 → onQuiet
 * 对讲时 talkActive：阈值临时 +6dB（家长声音经拍摄端外放的误报抑制）
 */
import { bandEnergy, voicedness, NoiseFloor } from '../utils/audio.mjs'

const ANALYZE_MS = 100
const QUIET_STREAK = 50 // 5s
const VOICE_THRESHOLD = 0.35
const MAX_GAP_FRAMES = 3 // 300ms

export function useCryDetector() {
  let audioCtx = null
  let analyser = null
  let freqData = null
  let timeData = null
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

    // iOS 需手势解锁：start 在"开始监控"按钮手势内调用
    audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    const src = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.3
    src.connect(analyser)
    freqData = new Float32Array(analyser.frequencyBinCount)
    timeData = new Float32Array(analyser.fftSize)

    timer = setInterval(analyze, ANALYZE_MS)
  }

  function analyze() {
    // 频带能量
    let energy
    if (typeof analyser.getFloatFrequencyData === 'function') {
      analyser.getFloatFrequencyData(freqData)
      energy = bandEnergy(analyser, freqData, 300, 3000)
    } else {
      // Safari 降级：byte 数据 (0-255) → 归一化
      const byteData = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(byteData)
      energy = bandEnergy(analyser, byteData, 300, 3000) * (2 / 3)
    }

    const floor = noiseFloor.update(energy)
    if (noiseFloor.isWarming()) return // 噪声底预热期不判定

    // voicedness
    analyser.getFloatTimeDomainData(timeData)
    const voice = voicedness(timeData, audioCtx.sampleRate)

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
      onCry?.()
    } else if (cryActive) {
      quietStreak++
      if (quietStreak >= QUIET_STREAK) {
        cryActive = false
        onQuiet?.()
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
    audioCtx?.close()
    audioCtx = null
    analyser = null
  }

  return { start, setTalkActive, setSensitivity, stop }
}
