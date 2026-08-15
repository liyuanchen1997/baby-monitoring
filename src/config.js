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

  // ---- 检测器通用参数（模块 7/8 使用）----
  detection: {
    sampleMs: 250, // 动作检测采样间隔（4fps）
    warmupFrames: 12, // 动作检测预热（3s @ 4fps）
    analyzeMs: 100, // 哭声检测分析间隔（10Hz）
    cryQuietStreak: 50, // 哭声解除：连续不达标帧数（5s）
    voiceThreshold: 0.35, // 周期性（voicedness）判定阈值
    maxGapFrames: 3, // 达标窗口内最大空隙（300ms）
    lightChangeRatio: 0.6, // 整帧均匀大面积变化 → 光照事件（不计入动作）
    eventMax: 10, // 拍摄端最近事件列表条数
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
    titleFlashMs: 1_000, // 标题闪烁周期
    chimeHz: 880, // 三连音频率
    vibratePattern: [200, 100, 200], // Android 振动模式
  },

  // ---- 存储键 ----
  storageKeys: {
    sensitivity: 'bm-sensitivity',
  },
}
