/**
 * 音频分析工具（哭声检测用，见设计文档 §7）
 * - bandEnergy: 频带能量（getFloatFrequencyData，Safari 降级 getByteFrequencyData）
 * - voicedness: 声音周期性（归一化自相关峰值，哭声 vs 白噪的关键区分）
 * - NoiseFloor: 自适应噪声底（60s 滑动窗低分位 EMA，窗帘/空调声自动学成正常）
 */

/** 计算指定频带 [startHz, endHz] 的平均能量（dBFS 归一化 0-1） */
export function bandEnergy(analyser, freqData, startHz, endHz) {
  const sampleRate = analyser.context.sampleRate
  const binWidth = sampleRate / analyser.fftSize
  const start = Math.max(0, Math.floor(startHz / binWidth))
  const end = Math.min(freqData.length, Math.ceil(endHz / binWidth))
  if (end <= start) return 0

  let sum = 0
  for (let i = start; i < end; i++) {
    sum += freqData[i]
  }
  const avg = sum / (end - start)
  // float 数据为 dB（-100..0），byte 数据为 0-255
  return (avg + 100) / 100 // 归一化 0-1
}

/**
 * 周期性（voicedness）：归一化自相关峰值
 * 在 [lagMin, lagMax] 样本区间（对应基频范围）计算自相关，
 * 哭声/人声是周期性发声 → 峰值显著；白噪/风扇 → 自相关平坦
 */
export function voicedness(timeData, sampleRate, lagMin = 20, lagMax = 200) {
  // 默认 100-600Hz：lag = sampleRate / f
  const n = timeData.length
  const searchStart = lagMin
  const searchEnd = Math.min(lagMax, n - 1)

  // 预计算均值与方差（归一化）
  let sum = 0
  for (let i = 0; i < n; i++) sum += timeData[i]
  const mean = sum / n
  let variance = 0
  for (let i = 0; i < n; i++) variance += (timeData[i] - mean) ** 2
  if (variance < 1e-6) return 0 // 静音

  let peak = 0
  for (let lag = searchStart; lag <= searchEnd; lag++) {
    let num = 0
    for (let i = 0; i < n - lag; i++) {
      num += (timeData[i] - mean) * (timeData[i + lag] - mean)
    }
    const corr = num / variance
    if (corr > peak) peak = corr
  }
  return Math.max(0, peak)
}

/**
 * 自适应噪声底：维护滑动窗口，取低分位（p20）做 EMA
 * 更新时传入当前频带能量，返回当前噪声底估计
 */
export class NoiseFloor {
  constructor({ windowSize = 60, lowPercentile = 0.2, emaFactor = 0.05 } = {}) {
    this.windowSize = windowSize
    this.lowPercentile = lowPercentile
    this.emaFactor = emaFactor
    this.buffer = []
    this.floor = 0
  }

  update(value) {
    this.buffer.push(value)
    if (this.buffer.length > this.windowSize) this.buffer.shift()

    // 滑动窗低分位
    const sorted = [...this.buffer].sort((a, b) => a - b)
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * this.lowPercentile))
    const low = sorted[idx]

    // EMA 平滑（首个样本直接采用）
    if (this.floor === 0) this.floor = low
    else this.floor = this.floor * (1 - this.emaFactor) + low * this.emaFactor
    return this.floor
  }

  /** 预热判断：窗口未填满时返回 true（检测器应暂不判定） */
  isWarming() {
    return this.buffer.length < Math.max(10, this.windowSize * 0.3)
  }
}
