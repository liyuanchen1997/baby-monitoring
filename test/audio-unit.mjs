/**
 * 音频分析纯函数单元测试（哭声检测核心算法，无需浏览器）
 * 覆盖：bandEnergy（频段能量）、voicedness（周期性）、NoiseFloor（自适应噪声底）
 *
 * 运行: node test/audio-unit.mjs
 */
import { bandEnergy, voicedness, NoiseFloor } from '../src/utils/audio.mjs'

let passed = 0
let failed = 0
function assert(name, cond) {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.error(`  ❌ ${name}`)
  }
}

// ---- bandEnergy ----
const fakeAnalyser = { context: { sampleRate: 48000 }, fftSize: 2048 }
const freqData = new Float32Array(1024) // frequencyBinCount = fftSize / 2
// 300Hz ≈ bin 13，3000Hz ≈ bin 128（binWidth ≈ 23.4Hz）
for (let i = 0; i < freqData.length; i++) {
  freqData[i] = i >= 13 && i <= 128 ? -30 : -100
}
const e = bandEnergy(fakeAnalyser, freqData, 300, 3000)
assert(`bandEnergy 频段能量正确（期望≈0.7，实际${e.toFixed(3)}）`, e > 0.6 && e < 0.8)

// 频段外能量不应计入
const eOut = bandEnergy(fakeAnalyser, freqData, 8000, 10000)
assert(`bandEnergy 频段外能量低（实际${eOut.toFixed(3)}）`, eOut < 0.1)

// ---- voicedness（确定性伪随机保证可复现）----
const sr = 48000
const n = 2048
function lcg(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const sin400 = new Float32Array(n) // 400Hz：lag = 120，在搜索区间内
for (let i = 0; i < n; i++) sin400[i] = Math.sin((2 * Math.PI * 400 * i) / sr)
const vSin = voicedness(sin400, sr)
assert(`voicedness 周期声（400Hz）高（实际${vSin.toFixed(2)}）`, vSin > 0.5)

const rand = lcg(42)
const noise = new Float32Array(n)
for (let i = 0; i < n; i++) noise[i] = rand() * 2 - 1
const vNoise = voicedness(noise, sr)
assert(`voicedness 白噪低（实际${vNoise.toFixed(3)}）`, vNoise < 0.2)

// ---- NoiseFloor ----
const nf = new NoiseFloor()
for (let i = 0; i < 120; i++) nf.update(0.1 + rand() * 0.05)
assert(`噪声底收敛到低值（实际${nf.floor.toFixed(3)}）`, nf.floor < 0.2)
assert('噪声底预热判定', nf.isWarming() === false)

// 突发高能量不污染噪声底（EMA 低分位）
const nf2 = new NoiseFloor()
for (let i = 0; i < 30; i++) nf2.update(0.1)
for (let i = 0; i < 10; i++) nf2.update(0.9) // 突发哭声
assert(`噪声底抗突发干扰（实际${nf2.floor.toFixed(3)}）`, nf2.floor < 0.3)

// 学习暂停：哭声激活时基线不随持续哭声抬升
const nf3 = new NoiseFloor()
for (let i = 0; i < 30; i++) nf3.update(0.1)
nf3.setLearning(false)
for (let i = 0; i < 100; i++) nf3.update(0.8) // 持续哭声
assert(`噪声底暂停学习（实际${nf3.floor.toFixed(3)}）`, nf3.floor < 0.3)

// byte 频带能量：刻度与 float dB 路径统一（0-1 范围）
const byteFake = { context: { sampleRate: 48000 }, fftSize: 2048, minDecibels: -100, maxDecibels: -30 }
const byteData = new Uint8Array(1024)
byteData.fill(0)
for (let i = 13; i <= 128; i++) byteData[i] = 255 // 300-3000Hz 满幅
const eByte = bandEnergy(byteFake, byteData, 300, 3000)
assert(`byte 频带能量刻度统一 0-1（实际${eByte.toFixed(3)}）`, eByte > 0.6 && eByte < 0.8)

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed ? 1 : 0)
