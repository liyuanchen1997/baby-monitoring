/**
 * 检测状态机编排（拍摄端）
 * 两个检测器（动作/哭声）→ 状态机 calm/moving/crying → 状态迁移时上报 + 心跳
 * - 优先级 crying > moving > calm
 * - seq 自增（服务器用于离线错过计数）
 * - 灵敏度三档（localStorage 持久化）；对讲激活抑制哭声误报
 */
import { ref } from 'vue'
import { CONFIG } from '../config.js'
import { useMotionDetector } from './useMotionDetector.mjs'
import { useCryDetector } from './useCryDetector.mjs'

const { eventMax: EVENT_MAX } = CONFIG.detection
const STORAGE_KEY = CONFIG.storageKeys.sensitivity
const SENSITIVITY_KEYS = Object.keys(CONFIG.sensitivity)

export function useActivityMonitor({ sendActivity, heartbeatMs = CONFIG.notifier.activityHeartbeatMs } = {}) {
  const state = ref('calm')
  const events = ref([])
  // localStorage 值校验：损坏/非法值回退默认（否则 cfg() 返回 undefined 使检测器启动崩溃）
  let saved = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    // 存储不可用（隐私模式等）：使用默认
  }
  const sensitivityLevel = ref(SENSITIVITY_KEYS.includes(saved) ? saved : 'medium')

  const motion = useMotionDetector()
  const cry = useCryDetector()

  let lastReported = 'calm'
  let seq = 0
  let heartbeatTimer = null
  // 检测器实时状态（推导式状态机：每个检测器事件到达时重新推导，
  // 不再依赖各回调的不对称守卫——修复 cry.onQuiet 覆盖 moving 的问题）
  let motionActive = false
  let cryActive = false

  function cfg() {
    return CONFIG.sensitivity[sensitivityLevel.value]
  }

  function report(next) {
    if (next === lastReported) return
    lastReported = next
    state.value = next
    seq++
    const evt = { state: next, ts: Date.now() }
    events.value.unshift(evt)
    if (events.value.length > EVENT_MAX) events.value.pop()
    sendActivity?.({ state: next, seq, ts: evt.ts })
  }

  /** 优先级推导：crying > moving > calm（每个检测器事件触发） */
  function recompute() {
    report(cryActive ? 'crying' : motionActive ? 'moving' : 'calm')
  }

  /** 开始检测（在"开始监控"手势内调用：iOS 音频解锁） */
  function start(video, stream) {
    motionActive = false
    cryActive = false
    motion.start(video, cfg(), {
      onActive: () => {
        motionActive = true
        recompute()
      },
      onQuiet: () => {
        motionActive = false
        recompute()
      },
    })
    cry.start(stream, cfg(), {
      onCry: () => {
        cryActive = true
        recompute()
      },
      onQuiet: () => {
        cryActive = false
        recompute()
      },
    }).catch(() => {}) // start 内部已防护；双保险防未处理 rejection
    clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(() => {
      // 非 calm 状态心跳（覆盖"持续哭闹但无状态迁移"场景）
      if (state.value !== 'calm') {
        sendActivity?.({ state: state.value, seq, ts: Date.now() })
      }
    }, heartbeatMs)
  }

  function setSensitivity(level) {
    if (!SENSITIVITY_KEYS.includes(level)) return
    sensitivityLevel.value = level
    try {
      localStorage.setItem(STORAGE_KEY, level)
    } catch {
      // Safari 隐私模式写入失败：静默忽略（本次会话仍生效）
    }
    motion.setSensitivity(cfg())
    cry.setSensitivity(cfg())
  }

  function setTalkActive(v) {
    cry.setTalkActive(v)
  }

  function stop() {
    motion.stop()
    cry.stop()
    clearInterval(heartbeatTimer)
    motionActive = false
    cryActive = false
    // 停止再开始 = 新检测会话：重置状态与上报基准，
    // 否则重启后首次检测到同状态会被 report() 判重跳过（只靠 30s 心跳兜底）
    lastReported = 'calm'
    state.value = 'calm'
    // 通知观看端监控已停止（否则服务器缓存停留最后状态：
    // 原观看端横幅挂满超时、新加入者收到假哭闹补发）
    if (sendActivity) {
      seq++
      sendActivity({ state: 'calm', seq, ts: Date.now() })
    }
  }

  return { state, events, sensitivityLevel, start, setSensitivity, setTalkActive, stop }
}
