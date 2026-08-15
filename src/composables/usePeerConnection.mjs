/**
 * RTCPeerConnection 封装（媒体协商层）
 *
 * 角色约定：拍摄端恒为唯一 offerer，观看端只应答（见设计文档 §3）。
 * 模块 3 覆盖：创建、offer/answer/ICE 处理、码率上限、连接状态归约；
 * 重连分层（restartIce/整体重建）在模块 5 落地。
 */
import { ref } from 'vue'
import { CONFIG } from '../config.js'

export function usePeerConnection() {
  const connectionState = ref('new') // new|connecting|connected|disconnected|failed|closed
  const iceState = ref('new') // new|checking|connected|completed|disconnected|failed|closed
  const everConnected = ref(false) // 本次会话是否成功建立过连接（AP 隔离判定用）
  let pc = null

  function create({ onIceCandidate, onStateChange, onTrack } = {}) {
    if (pc) pc.close() // 重建前先释放旧连接，避免泄漏
    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pc.onicecandidate = (e) => {
      if (e.candidate) onIceCandidate?.(e.candidate.toJSON())
    }
    pc.onconnectionstatechange = () => {
      connectionState.value = pc.connectionState
      onStateChange?.(pc.connectionState)
    }
    pc.oniceconnectionstatechange = () => {
      iceState.value = pc.iceConnectionState
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        everConnected.value = true
      }
    }
    pc.ontrack = (e) => {
      if (!onTrack) return
      // iOS Safari 部分版本 e.streams 为空，用 track 兜底构造
      const stream = e.streams[0] || new MediaStream([e.track])
      onTrack(stream)
    }
    connectionState.value = 'new'
    iceState.value = 'new'
    return pc
  }

  /** 拍摄端：添加本地媒体 → 生成 offer */
  async function makeOffer(localStream) {
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream))
    await applyBitrate() // sender 已就绪，立即施加码率上限（失败降级，不阻塞）
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    return offer
  }

  /** 观看端：接收 offer → 预留对讲音频通道 → 生成 answer */
  async function handleOffer(sdp) {
    await pc.setRemoteDescription({ type: 'offer', sdp })
    // sendrecv：接收拍摄端音频 + 预留对讲发送通道（模块 4 用 replaceTrack 填充）
    pc.addTransceiver('audio', { direction: 'sendrecv' })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return answer
  }

  /** 观看端：把发送方向切为接收（拍摄端 offer 中原有的 audio 通道复用） */
  async function handleAnswer(sdp) {
    await pc.setRemoteDescription({ type: 'answer', sdp })
  }

  /**
   * ICE restart：带 iceRestart 标志的新 offer（仅拍摄端调用）
   * 不重建连接，只是重新收集候选 —— 用于 disconnected（WiFi 瞬断等）场景
   */
  async function restartIce() {
    const offer = await pc.createOffer({ iceRestart: true })
    await pc.setLocalDescription(offer)
    return offer
  }

  async function handleIce(candidate) {
    if (!pc) return
    try {
      await pc.addIceCandidate(candidate)
    } catch {
      // 候选可能早于远端描述到达（trickle 时序），忽略
    }
  }

  /** 视频编码码率上限（config.video.maxBitrate） */
  async function applyBitrate() {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue
      const params = sender.getParameters()
      if (!params.encodings?.length) continue
      params.encodings[0].maxBitrate = CONFIG.video.maxBitrate
      try {
        await sender.setParameters(params)
      } catch {
        // 部分浏览器（iOS Safari）对 setParameters 支持有限，降级不阻塞
      }
    }
  }

  function close() {
    pc?.close()
    pc = null
    connectionState.value = 'closed'
  }

  /** 暴露当前底层 RTCPeerConnection（对讲 replaceTrack 等用） */
  function get() {
    return pc
  }

  return {
    connectionState,
    iceState,
    everConnected,
    create,
    makeOffer,
    handleOffer,
    handleAnswer,
    handleIce,
    restartIce,
    applyBitrate,
    close,
    get,
  }
}
