/**
 * 观看端提醒编排（横幅 + 声音 + 系统通知 + 标题闪烁 + 振动）
 * - 状态驱动而非事件驱动：activity 状态变化更新横幅，calm 或 3min 超时清除
 * - 哭闹（crying）：横幅红 + 三连音 + 系统通知 + 标题闪烁 + 振动
 * - 活动（moving）：横幅黄 + 系统通知（不响铃，避免频繁打扰）
 * - enable() 须在用户手势内调用（"开启提醒"按钮）：iOS AudioContext 解锁 + 通知权限申请
 * - iOS Safari 不支持网页通知（仅横幅+声音），文档已注明
 */
import { ref } from 'vue'
import { CONFIG } from '../config.js'

const BANNER_TIMEOUT_MS = CONFIG.notifier.bannerTimeoutMs
const TITLE_FLASH_MS = CONFIG.notifier.titleFlashMs
const CHIME_HZ = CONFIG.notifier.chimeHz
const VIBRATE_PATTERN = CONFIG.notifier.vibratePattern
const BASE_TITLE = '👶 宝宝监控'

export function useNotifier() {
  const enabled = ref(false)
  const banner = ref(null) // { level: 'moving' | 'crying', ts }
  const soundSupported = ref(typeof AudioContext !== 'undefined')
  const notifySupported = ref(typeof Notification !== 'undefined')

  let audioCtx = null
  let bannerTimer = null
  let titleTimer = null
  let titleCry = false
  let lastNotifiedState = null // 状态迁移去重（心跳不重复告警）

  /** 开启提醒（用户手势内调用：音频解锁 + 通知权限） */
  function enable() {
    enabled.value = true
    if (soundSupported.value && !audioCtx) {
      audioCtx = new AudioContext()
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {}) // 拒绝静默降级（不产生未处理 rejection）
      }
    }
    if (notifySupported.value && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }

  function disable() {
    enabled.value = false
    clearBanner()
    stopTitleFlash()
    lastNotifiedState = null
  }

  /** 组件卸载清理（标题闪烁/横幅计时器/音频上下文） */
  function dispose() {
    clearTimeout(bannerTimer)
    stopTitleFlash()
    audioCtx?.close().catch(() => {})
    audioCtx = null
  }

  function clearBanner() {
    clearTimeout(bannerTimer)
    banner.value = null
  }

  function showBanner(level) {
    const isNewLevel = !banner.value || banner.value.level !== level
    banner.value = { level, ts: Date.now() }
    if (isNewLevel) {
      // 仅状态变化时重置 3min 超时（心跳刷新不重置，否则横幅永不自动清除）
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(clearBanner, BANNER_TIMEOUT_MS)
    }
  }

  /** 三连短音，须在 enable 手势后可用 */
  function playSound() {
    if (!audioCtx) return
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {}) // 迟到的手势解锁
    const now = audioCtx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = CHIME_HZ
      gain.gain.setValueAtTime(0.25, now + i * 0.28)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.28 + 0.22)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(now + i * 0.28)
      osc.stop(now + i * 0.28 + 0.24)
    }
  }

  function notify(title, body) {
    if (!notifySupported.value || Notification.permission !== 'granted') return
    try {
      new Notification(title, { body })
    } catch {
      // 某些环境（iOS 旧版）构造失败，静默降级
    }
  }

  function startTitleFlash() {
    stopTitleFlash()
    titleTimer = setInterval(() => {
      titleCry = !titleCry
      document.title = titleCry ? '🔴 宝宝在哭' : BASE_TITLE
    }, TITLE_FLASH_MS)
  }

  function stopTitleFlash() {
    clearInterval(titleTimer)
    document.title = BASE_TITLE
  }

  function vibrate() {
    if (navigator.vibrate) navigator.vibrate(VIBRATE_PATTERN)
  }

  /** activity 消息入口（状态驱动；同状态心跳只刷新横幅，不重放完整告警） */
  function onActivity(evt) {
    if (!enabled.value) return
    if (evt.state === 'calm') {
      clearBanner()
      stopTitleFlash()
      lastNotifiedState = null
      return
    }
    const level = evt.state
    const isTransition = level !== lastNotifiedState
    lastNotifiedState = level
    showBanner(level)
    if (!isTransition) return // 心跳（同状态）不重复响铃/通知/振动
    if (level === 'crying') {
      playSound()
      notify('🔴 宝宝在哭', '检测到持续哭闹')
      startTitleFlash()
      vibrate()
    } else {
      stopTitleFlash() // 哭闹→活动时停止红色标题闪烁（防御性：正常路径由 calm 清除）
      notify('🟡 宝宝有活动', '检测到轻微活动')
    }
  }

  /** 离线错过提示（服务器 activity-backlog） */
  function onBacklog(missed) {
    if (!enabled.value || !missed) return
    notify('⏳ 错过了提醒', `离线期间错过 ${missed} 次检测事件`)
  }

  return {
    enabled,
    banner,
    soundSupported,
    notifySupported,
    enable,
    disable,
    dispose,
    onActivity,
    onBacklog,
  }
}
