/**
 * 屏幕常亮（Wake Lock）
 * - 浏览器在锁屏/切后台时会释放锁，visibilitychange 回前台需重新请求
 * - iOS < 16.4 不支持 → 返回降级提示（用户手动设置永不锁屏）
 */
import { ref } from 'vue'

export function useWakeLock() {
  const supported = 'wakeLock' in navigator
  const active = ref(false)
  let lock = null

  async function request() {
    if (!supported || active.value || document.visibilityState !== 'visible') return
    try {
      lock = await navigator.wakeLock.request('screen')
      active.value = true
      lock.addEventListener('release', () => {
        active.value = false
        lock = null
      })
    } catch {
      // 用户拒绝/系统不允许，静默降级（视图层根据 supported 显示提示）
    }
  }

  async function release() {
    try {
      await lock?.release()
    } catch {
      // 已释放则忽略
    }
    lock = null
    active.value = false
  }

  // 回前台重新请求（浏览器会在不可见时释放锁）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request()
  })

  return { supported, active, request, release }
}
