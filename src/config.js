/**
 * 全局可调参数集中配置
 * 所有阈值/分辨率/灵敏度都在这里改，不要散落在组件中。
 */
export const CONFIG = {
  // 信令 WS 地址：同源推导（dev: vite proxy → 后端；prod: 同端口）
  signalingPath: '/ws',

  // ---- 音视频（模块 3 使用）----
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 24 },
    maxBitrate: 1_500_000, // bps，offer 建立后施加
  },

  // ---- 检测（模块 7 使用）----
  // 灵敏度三档：动作检测（diffThreshold / 网格变化数 K / 连续帧 N）+ 哭声检测（能量阈值 dB / 达标窗口 ms）
  sensitivity: {
    low: {
      diffThreshold: 30, changedCells: 4, frames: 4,
      cryDb: 24, cryWindowMs: 2500,
    },
    medium: {
      diffThreshold: 25, changedCells: 3, frames: 3,
      cryDb: 18, cryWindowMs: 2000,
    },
    high: {
      diffThreshold: 18, changedCells: 2, frames: 2,
      cryDb: 12, cryWindowMs: 1500,
    },
  },

  // ---- 重连（模块 5 使用）----
  reconnect: {
    wsBaseMs: 1000, wsMaxMs: 30_000, // L0 WS 指数退避
    iceDisconnectedMs: 5_000,        // L1 disconnected 容忍时间
    mediaFrozenMs: 5_000,            // L2 媒体冻结判定
    joinRetryMs: 2_000, joinRetryMax: 60_000, // room-not-found 重试
  },

  // ---- 提醒（模块 8 使用）----
  notifier: {
    bannerTimeoutMs: 3 * 60_000, // 横幅超时自动清除
    activityHeartbeatMs: 30_000, // 非 calm 状态心跳间隔
  },
}
