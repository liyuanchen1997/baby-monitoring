/**
 * 帧间差分动作检测（纯 canvas，无库）
 * 算法（见设计文档 §6）：
 * 1. 视频帧 drawImage 到 160x120 隐藏 canvas → 灰度化
 * 2. 8x6=48 网格：单元内差异像素占比 >15% 记 changedCell
 * 3. changedCells ≥ K → 本帧"有动作"
 * 4. 光照变化过滤：整帧差异 >60%（均匀大面积）→ 判光照事件不计入
 *
 * 返回 { changedCells, diffRatio, isLightChange, isMotion }
 */
export function createFrameDiff({ diffThreshold = 25, changedCellsMin = 3, cellRatio = 0.15 } = {}) {
  const W = 160
  const H = 120
  const COLS = 8
  const ROWS = 6
  const CELL_W = W / COLS
  const CELL_H = H / ROWS
  const LIGHT_CHANGE_RATIO = 0.6

  let canvas = null
  let ctx = null
  let prev = null // Uint8ClampedArray 灰度帧

  function ensureCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      ctx = canvas.getContext('2d', { willReadFrequently: true })
    }
  }

  /** 单帧分析；prev 为 null 时（首帧）只记录不判定 */
  function analyze(video) {
    ensureCanvas()
    ctx.drawImage(video, 0, 0, W, H)
    const data = ctx.getImageData(0, 0, W, H).data

    // 灰度化
    const gray = new Uint8ClampedArray(W * H)
    for (let i = 0; i < W * H; i++) {
      gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) | 0
    }

    if (!prev) {
      prev = gray
      return { changedCells: 0, diffRatio: 0, isLightChange: false, isMotion: false, first: true }
    }

    // 逐像素差异
    let diffPixels = 0
    const cellChanged = new Array(COLS * ROWS)
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        let changed = 0
        for (let y = cy * CELL_H; y < (cy + 1) * CELL_H; y++) {
          const row = y * W
          for (let x = cx * CELL_W; x < (cx + 1) * CELL_W; x++) {
            const d = Math.abs(gray[row + x] - prev[row + x])
            if (d > diffThreshold) {
              changed++
              diffPixels++
            }
          }
        }
        cellChanged[cy * COLS + cx] = changed / (CELL_W * CELL_H) > cellRatio
      }
    }

    prev = gray

    const totalPixels = W * H
    const diffRatio = diffPixels / totalPixels
    const isLightChange = diffRatio > LIGHT_CHANGE_RATIO // 均匀大面积变化 → 光照事件
    const changedCells = cellChanged.filter(Boolean).length
    return {
      changedCells,
      diffRatio,
      isLightChange,
      isMotion: !isLightChange && changedCells >= changedCellsMin,
    }
  }

  function reset() {
    prev = null
  }

  return { analyze, reset }
}
