/**
 * 生成确定性 fake 摄像头视频（y4m 格式）：白方块在深色背景上从左向右移动
 * Chromium 的 --use-file-for-fake-video-capture 用此文件替代默认测试图案，
 * 保证动作检测测试可复现（默认图案在某些实例输出静止帧，导致 flaky）
 *
 * 320x180 @ 15fps, 5s（75 帧，≈6.5MB）
 * 运行: node test/gen-fake-cam.mjs [/tmp/fake-cam.y4m]
 */
import fs from 'node:fs'

const W = 320
const H = 180
const FPS = 15
const FRAMES = 75
const BLOCK = 120 // 方块边长（缩放 160x120 后覆盖 3x3 检测网格，满足 changedCells≥3）
const STEP = 8 // 每帧移动像素

const Y_FRAME = W * H
const UV_FRAME = (W / 2) * (H / 2)
const FRAME_SIZE = Y_FRAME + 2 * UV_FRAME

const out = process.argv[2] || '/tmp/fake-cam.y4m'
const y = Buffer.alloc(Y_FRAME)
const uv = Buffer.alloc(2 * UV_FRAME) // 中性色 U/V = 128

const header = `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`
const frameHeader = 'FRAME\n'
const chunks = [Buffer.from(header)]

const Y0 = Math.floor((H - BLOCK) / 2) // 垂直居中
for (let f = 0; f < FRAMES; f++) {
  const x = (f * STEP) % (W - BLOCK)
  y.fill(16) // 深色背景（Y=16）
  for (let by = 0; by < BLOCK; by++) {
    const rowStart = (Y0 + by) * W + x
    y.fill(235, rowStart, rowStart + BLOCK) // 白方块（Y=235）
  }
  uv.fill(128)
  // Buffer 是引用：必须拷贝，否则所有帧都是同一块内存的最终内容
  chunks.push(Buffer.from(frameHeader), Buffer.from(y), Buffer.from(uv))
}

fs.writeFileSync(out, Buffer.concat(chunks))
console.log(`✅ fake 摄像头视频已生成: ${out} (${chunks[0].length + (FRAME_SIZE + 7) * FRAMES} 字节)`)
