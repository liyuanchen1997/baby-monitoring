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

const EVENT_MAX = 10

export function useActivityMonitor({ sendActivity, heartbeatMs = CONFIG.notifier.activityHeartbeatMs } = {}) {
  const state = ref('calm')
  const events = ref([])
  const sensitivityLevel = ref(localStorage.getItem('bm-sensitivity') || 'medium')

  const motion = useMotionDetector()
  const cry = useCryDetector()

  let lastReported = 'calm'
  let seq = 0
  let heartbeatTimer = null

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

  /** 开始检测（在"开始监控"手势内调用：iOS 音频解锁） */
  function start(video, stream) {
    motion.start(video, cfg(), {
      onActive: () => {
        if (state.value !== 'crying') report('moving')
      },
      onQuiet: () => {
        if (state.value !== 'crying') report('calm')
      },
    })
    cry.start(stream, cfg(), {
      onCry: () => report('crying'),
      onQuiet: () => report('calm'),
    })
    clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(() => {
      // 非 calm 状态心跳（覆盖"持续哭闹但无状态迁移"场景）
      if (state.value !== 'calm') {
        sendActivity?.({ state: state.value, seq, ts: Date.now() })
      }
    }, heartbeatMs)
  }

  function setSensitivity(level) {
    sensitivityLevel.value = level
    localStorage.setItem('bm-sensitivity', level)
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
  }

  return { state, events, sensitivityLevel, start, setSensitivity, setTalkActive, stop }
}
