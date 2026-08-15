# 更新日志

> 格式：日期 · 模块 · 变更类型（新增/更新/修改/修复）· 说明。每次变更必须记录。

## 2026-08-15 · 模块 0（项目初始化与文档）· v0.1.0

- **新增**：项目骨架约定（Vue 3 + Vite + Node.js/Express/ws，WebRTC 点对点，纯局域网）
- **新增**：CLAUDE.md 开发协作文档（技术栈、模块划分、开发流程约定、架构决策、已知限制）
- **新增**：README.md 用户文档（安装、证书、手机配置、使用流程、PC 端说明、已知限制）
- **新增**：doc/需求文档.md v1.0（FR-1~FR-6 功能需求、NFR 非功能需求、真机验收矩阵、边界限制）
- **新增**：doc/设计文档.md v1.0（架构总览、信令协议、重连分层、检测算法、双端适配、已知限制）
- **新增**：doc/CHANGELOG.md（本文件，变更记录约定）
- **新增**：分模块开发流程（每模块开发完成即停止，等待用户确认后进行下一步）
- **新增**：需求确认：纯局域网场景 + 全功能（视频/对讲/截图录制/连接保障/检测提醒）+ PC 与移动双端支持
- **新增**：项目骨架代码：package.json（express 5 / ws 8 / qrcode / vite 8 / vue 3.5）、.gitignore、index.html、vite.config.mjs（证书存在时启用 HTTPS + /ws、/api 代理到 :3443）、src/main.js、src/style.css（移动优先暗色主题 + ≥1024px PC 断点）、src/config.js（全局参数集中配置）、src/App.vue（URL ?join= 驱动视图分发，无 vue-router）、HomeView（完整骨架）/ CameraView / ViewerView（占位，后续模块填充）
- **验证**：`npm run dev:client` 出页 HTTP 200，Vue SFC 编译正常（App.vue / HomeView.vue / style.css 均 200）

## 2026-08-15 · 模块 1（HTTPS 证书与环境）· v0.2.0

- **新增**：`server/lan.mjs` — 局域网 IPv4 检测工具（优先 192.168/10./172.16-31 内网段），供证书/启动脚本/后端复用
- **新增**：`scripts/cert.mjs` — mkcert 检查（缺失提示 `brew install mkcert nss`）、安装本地 CA（非交互终端授权失败时降级不阻塞）、签发含 localhost+全部 LAN IP SAN 的证书（certs/dev-cert.pem，有效期 3 年）、打印根证书路径
- **新增**：`scripts/serve-cert.mjs` — 纯 HTTP 伺服 rootCA 供手机下载（绕过未信任页面禁止下载的问题），端口可被环境变量 PORT 覆盖、遇占用自动递增避让（最多 10 次）
- **新增**：`scripts/dev.mjs` — 开发环境一键编排：证书检查 → 并行启动后端(:3443，模块 2 落地后生效)与前端(:5173) → 打印各设备访问清单；任一子进程退出即整体停止
- **环境**：安装 mkcert v1.4.4（brew）；本机钥匙串授权在非交互终端下受限（提示用户可自行运行 `mkcert -install` 获得 macOS 绿锁，不影响手机端）
- **验证**：证书 SAN 正确（DNS:localhost, IP:127.0.0.1, IP:192.168.31.184）；`--cacert rootCA.pem` 验证信任链完整 HTTP 200（模拟手机装 CA 后效果）；vite HTTPS 出页 200；serve-cert 端口避让（8080 被占用→8081）与 rootCA.pem 下载正常

## 2026-08-15 · 模块 2（信令服务器与页面骨架）· v0.3.0

- **新增**：`server/signaling.mjs` — WebSocket 信令服务器（挂载 /ws）：房间管理（一房 2 peer：camera/viewer）、offer/answer/ice/restart-request 原样中继、activity 最新状态缓存与补发/离线错过提示（activity-backlog）、30s 心跳保活、拍摄端断开即删房/观看端断开仅清槽位、发送失败立即 terminate
- **新增**：`server/index.mjs` — HTTPS 入口（:3443）：/api/info 返回 LAN IP（供二维码）、dist/ 存在时挂载静态服务 + SPA fallback（express 5 中间件兜底）、挂载信令
- **新增**：`src/composables/useSignaling.mjs` — 前端 WS 封装：同源地址推导、指数退避重连（1s→30s）、按 type 分发（on 返回取消函数）、20s ping 保活
- **更新**：CameraView — 连接就绪自动建房、房间码大字显示、观看端加入/离开状态、重连带恢复码重建同码房间
- **更新**：ViewerView — 加入房间、room-not-found 自动重试（2s 间隔 60s 上限）、camera-left 状态、activity 消息透传（供模块 7/8 消费）
- **新增**：`test/signaling-smoke.mjs` — 冒烟测试：带消息队列的 ws 客户端（防连帧消息丢失），17 项断言覆盖建房/加入/中继/补发/backlog/满员/离开/恢复码/冲突/not-found/ping
- **验证**：smoke 17/17 通过；dev 全链路通（/api/info 正确、vite 页面与 SFC 编译 200、WS 代理 5173→3443 ping/pong 通）
- **修复**（测试脚本）：初版 once() 监听器切换间隙丢失连帧消息 → 改为消息队列式客户端

## 2026-08-15 · UI 设计规范确立 · v0.3.1

- **新增**：UI 设计方向确认——「夜灯守护」：深夜蓝紫基底（#0B1026）+ 夜灯琥珀主色（#F5B85C），低光护眼；等宽大字数字（房间码）＝对讲机数字屏意象；呼吸光环表达连接状态；毛玻璃悬浮控制条；珊瑚红告警色夜视友好
- **更新**：`src/style.css` 全面重构为设计 token 体系（色彩/字体/圆角/辉光变量 + 胶囊按钮 + 毛玻璃面板 + 等宽数字 + 呼吸/告警动画，respect prefers-reduced-motion）
- **更新**：doc/设计文档.md 新增 §14「UI 设计规范（夜灯守护）」；doc/需求文档.md 新增 NFR-5 UI 设计
- 后续模块所有视图按此规范实现

## 2026-08-15 · 模块 3（媒体链路）· v0.4.0

- **新增**：`src/composables/useCamera.mjs` — getUserMedia 采集（后置优先/720p/24fps/AEC+降噪+自动增益）、前后置翻转（重建采集流）、错误文案映射（权限/设备/占用）
- **新增**：`src/composables/usePeerConnection.mjs` — RTCPeerConnection 封装：拍摄端恒为 offerer / 观看端只应答（addTransceiver audio sendrecv 预留对讲通道）、trickle ICE 双向转发、offer 后立即施加 maxBitrate 1.5Mbps（setParameters 失败降级）、ontrack 收流（iOS 空 streams 兜底）
- **新增**：组件 — `CameraPreview`（本地回显，muted 防啸叫，16:9 cover）、`ViewerStage`（远程画面，muted+autoplay 先播 +「点击开启声音」遮罩处理 iOS 手势策略）、`ConnectionBadge`（5 态呼吸光环徽标）
- **更新**：CameraView — 开始监控/停止/翻转、观看端加入后自动协商推流（gUM 与 peer-joined 双条件齐备）、重连恢复码重建；ViewerView — join 成功创建 PC、应答 offer、接收远端流播放；退出按钮（App.vue 监听回首页）；两视图按夜灯守护规范重构（琥珀等宽房间码、玻璃控制栏、胶囊按钮）
- **验证**：8 个新/改文件 vite 编译 200 无错误；真实浏览器双标签互看待用户验证（本机 Chrome 需先处理证书警告或 `mkcert -install`）

## 2026-08-15 · 修复 · v0.4.1

- **修复**（重要）：CameraView/ViewerView 从未调用 `connect()` —— useSignaling 的连接函数未在视图挂载时执行，WebSocket 始终未发起，页面永远"未连接"。模块 2/3 验证仅覆盖编译与 smoke（测试直连服务器，不经过前端 connect），真实浏览器测试才暴露。已在两视图 onMounted 中调用 connect()，真机验证通过
- **新增**：server/signaling.mjs 开发辅助日志（[ws] 连接建立/建房/加入/断开），便于排障；log 函数置于模块级避免作用域问题
- **验证**：真浏览器链路通——拍摄端建房 365548 → 观看端加入成功（服务端日志确认）

## 2026-08-15 · 模块 3 真机验证通过 · v0.4.2

- **验证**：macOS Chrome 双标签页互看通过——实时画面正常、声音正常（Chrome 有用户手势直接解锁，「点击开启声音」遮罩为 iOS 兜底，仅在无手势场景出现）；翻转/停止功能待后续测试
- **说明**：iOS Safari 真机测试列入最终验收矩阵（README/需求文档已含）

## 2026-08-15 · 模块 4（对讲/截图/录制）· v0.5.0

- **新增**：`src/composables/useTalk.mjs` — 按住说话：按需 gUM 麦克风（手势内申请）、`replaceTrack` 切换（按下发送/松开置 null，麦克风轨道复用）、复用模块 3 预留的 sendrecv transceiver 不重新协商
- **新增**：`src/composables/useScreenshot.mjs` — canvas 截取远程帧 → PNG；`navigator.share` 优先（iOS 对 a.download 支持差）、下载兜底
- **新增**：`src/composables/useRecorder.mjs` — 全平台统一 canvas 兜底路径（防 iOS 直录远程流黑屏 bug）：rAF drawImage → `captureStream(30)` + 拼接远端音频 → MediaRecorder；mimeType 按 isTypeSupported 选 mp4(avc1)/webm(vp8,opus)；`start(1000)` timeslice 修 Chrome duration bug；停止时仅停录制流自带 video track（不动远程音频）
- **新增**：`src/components/TalkButton.vue` — 按住说话按钮：touch/mouse 双事件 + preventDefault 防滚动误触、touch-action none、按住琥珀点亮「松开停止」
- **更新**：ViewerView — 底部毛玻璃控制栏（截图/说话/录制/退出），录制中按钮红色脉动；ViewerStage expose video 元素供截图录制；`usePeerConnection` 新增 `get()` 暴露底层 PC
- **更新**：CameraView — 隐藏 audio 元素外放观看端对讲声（onTrack 接入；「开始监控」手势内 play() 解锁 iOS 音频）
- **验证**：7 个新/改文件 vite 编译 200 无错误；真实浏览器测试待用户验证

## 2026-08-15 · 修复 · v0.5.1

- **修复**：对讲"未找到音频通道"——`useTalk` 用 `s.track?.kind === 'audio'` 匹配 sender，但 addTransceiver 创建的 sender 初始 track 为 null（replaceTrack 后才填入），改为匹配 `s.kind === 'audio'`。真机验证通过（按住说话 → 拍摄端扬声器出声）
- **验证**：按住说话功能通过；截图/录制验证待用户确认

## 2026-08-15 · 模块 5（连接保障）· v0.6.0

- **新增**：`src/composables/useWakeLock.mjs` — 屏幕常亮（screen wake lock + visibilitychange 回前台重新请求 + iOS<16.4 降级提示），拍摄端/观看端均启用，拍摄端房间卡显示常亮状态提示
- **更新**：`usePeerConnection` — create 前先 close 旧 PC（防泄漏）；新增 `iceState`/`everConnected` 状态（AP 隔离判定）；新增 `restartIce()`（iceRestart 新 offer，不重建）
- **更新**：CameraView — L1 ICE 状态机：disconnected 容忍 5s → `restartIce` 重协商；failed → 整体重建 PC（保留 WS 与房间）；L2 媒体冻结检测（requestVideoFrameCallback，connected 且 >5s 无新帧 → restartIce）；处理 `restart-request`
- **更新**：ViewerView — failed 5s 后仍失败 → 发 `restart-request` 请求拍摄端重协商；AP 隔离提示（WS 正常 + ICE failed + 从未连接成功 → 黄框提示路由器可能开启客户端隔离）
- **验证**：5 个新/改文件编译 200 无错误；真实断网重连待用户验证（飞行模式/WiFi 断开 10s 再恢复，画面应自动续上）

## 2026-08-15 · 修复 · v0.6.1

- **修复**（重要）：对讲"未找到音频通道"根治——Safari 未实现 `RTCRtpSender.kind`（实测 undefined）且接收通道 sender.track 恒为 null，原匹配条件永远落空。改为匹配 transceiver：`direction ∈ {sendrecv, sendonly}` 且 `receiver.track.kind === 'audio'`（Safari/Chrome 通用）
- **修复**：handleOffer 重复 addTransceiver 的累积检查同样依赖失效的 sender.kind → 改为 receiver.track.kind 判断，重协商不再累积音频通道（此前实测出现 8 个 sender）
- **修复**：ViewerView.ensurePeer 重复创建 PC（create 后状态仍 'new'，每次 offer/join 都重建）→ 增加 pcCreated 标志
- **新增**：useTalk 调试日志（[talk] press 输出 pc 状态与 transceiver 列表）
- **验证**：Safari 按住说话通过（matched sender: true, direction: sendrecv）

## 2026-08-15 · 自动化测试基础设施 + 对讲协商根治 · v0.6.2

- **新增**：Playwright 自动化测试基础设施——`@playwright/mcp`（对话内控制浏览器，需重启会话生效）+ playwright 库（Chromium 已下载）；`npm run e2e` 跑 `test/e2e-smoke.mjs`：模拟摄像头/麦克风（fake device）、自动验证双标签互看/按住说话/控制台错误，6 项断言
- **修复**（重要，对讲协商根治）：观看端 audio 通道在 answer 中恒为 recvonly，对讲音频发不出——headless Chrome 暴露（Safari 匹配碰巧成功掩盖了此 bug）。根因：协商前 addTransceiver 的 sendrecv 通道在 setRemoteDescription 时 m-line 匹配失败成孤儿，远端 audio m-line 匹配给了自动创建的 recvonly transceiver。修复：setRemoteDescription 后直接把远端 audio transceiver 的 direction 改为 sendrecv（单一通道双向，无 m-line 匹配不确定性）
- **更新**：signaling 服务器新增 SDP m-line/方向调试日志（仅开发）
- **验证**：e2e 6/6 通过（建房/本地预览/实时画面/对讲音频流/无错误提示/无控制台错误）

## 2026-08-15 · 模块 6（二维码配对）· v0.7.0

- **新增**：`src/components/QrOverlay.vue` — 二维码配对组件：qrcode 库 toCanvas 渲染；URL 内容 `${protocol}//${lanIp}:${port}/?join=<房间码>`（lanIp 来自 /api/info，拍摄端经 localhost 打开二维码仍指向局域网 IP）；深蓝模块白底高对比、URL 文本小字展示；房间码变化自动重渲染
- **更新**：CameraView 房间卡集成 QrOverlay（房间码下方展示二维码）；?join= 预填入口模块 0 已具备（HomeView 自动识别）
- **验证**：e2e 7/7 通过（新增二维码断言：canvas 渲染 >100px、URL 以 https:// 开头且含 /?join=）；真机扫码待验证（手机需先装 rootCA 才能直接打开）

## 2026-08-15 · 模块 7（动作/哭闹检测）· v0.8.0

- **新增**：`src/utils/frameDiff.mjs` — 帧间差分：160x120 灰度化、8x6 网格单元差分（单元变化占比 >15% 记 changedCell）、整帧 >60% 判光照事件不计入
- **新增**：`src/utils/audio.mjs` — 频带能量 bandEnergy（getFloatFrequencyData + Safari byte 降级）、周期性 voicedness（归一化自相关，100-600Hz）、自适应噪声底 NoiseFloor（60s 窗低分位 EMA）
- **新增**：`useMotionDetector` — 4fps 采样、3s 预热、连续 N 帧迟滞判定（onActive/onQuiet）、灵敏度即时重建
- **新增**：`useCryDetector` — 100ms 分析帧：能量-噪声底 + voicedness >0.35 达标；滚动窗口（cryWindowMs 内 ≥70% 达标且空隙 ≤300ms）判哭闹；连续 5s 不达标解除；对讲时阈值 +6dB（talkActive 抑制误报）
- **新增**：`useActivityMonitor` — 状态机 calm/moving/crying（优先级 crying > moving）、状态迁移上报（seq 自增）+ 非 calm 30s 心跳、灵敏度三档 localStorage 持久化、最近 10 条事件
- **新增**：组件 — `ActivityBadge`（三色呼吸点 + 最近事件时间戳列表）、`SensitivityPicker`（低/中/高胶囊分段）
- **更新**：CameraView — 开始监控时启动双检测器（手势内创建 AudioContext 解锁 iOS）、对讲播放自动 talkActive 抑制、停止监控时释放
- **验证**：e2e 8/8 通过（新增"动作检测识别画面运动"——fake camera 运动图案触发 moving）；`test:audio-unit` 7/7（bandEnergy 0.694、voicedness 周期 0.94 vs 白噪 0.05、噪声底收敛与抗突发）；真机哭声/光照/对讲误报测试留待统一验证

## 2026-08-15 · 模块 8（观看端提醒）· v0.9.0

- **新增**：`src/composables/useNotifier.mjs` — 提醒编排：状态驱动横幅（calm 或 3min 超时清除）；crying 触发三连音（880Hz 振荡器，enable 手势内解锁 AudioContext）+ 系统通知 + 标题闪烁 + Android 振动；moving 仅横幅+通知；`enable()` 内申请 Notification 权限；离线错过提示（activity-backlog → 系统通知）
- **新增**：`src/components/AlertBanner.vue` — 告警横幅（哭闹红辉光/活动黄）+ 滑入动画
- **更新**：ViewerView — 控制栏新增 🔔 提醒开关（开启琥珀高亮）、AlertBanner 置于画面上方、activity 消息接入 notifier、backlog 提示
- **修复**：motion detector 帧冻结保护——视频出帧停止（后台 tab/摄像头故障）时画面静止 ≠ 宝宝安静，跳过采样不累计判定，防止误报 calm
- **测试基础设施**：e2e 改为双独立 context（模拟两台设备，避免后台 tab 冻结）；`test/gen-fake-cam.mjs` 生成确定性 fake 摄像头视频（120px 移动方块 y4m，修复 Buffer 引用拷贝 bug——原版所有帧为同一内存导致画面静止），Chromium 默认测试图案在某些实例输出静止帧导致 flaky，改用 `--use-file-for-fake-video-capture` 后完全确定
- **验证**：e2e 9/9 稳定通过（连续 5 次）；修复前 flaky 根因：默认 fake 图案静止帧 + 同 context 多 tab 后台冻结

## 2026-08-15 · 模块 9（打磨与收尾）+ 检测状态机修复 · v1.0.0

- **修复**（重要）：`useActivityMonitor.stop()` 不重置 `lastReported` —— 停止监控再开始后，检测到与上次相同的状态（如 moving）被 report() 判重跳过，观看端收不到迁移提示（仅靠 30s 心跳兜底）。修复：stop() 重置 lastReported 与 state 为 calm（停止再开始 = 新检测会话）
- **更新**：e2e 支持 `E2E_PORT` 环境变量（验证生产模式）、失败分支输出状态时间线诊断
- **验证**：dev 模式 e2e 5/5 通过、生产模式（build + start :3443）e2e 3/3 通过；生产链路全通（静态服务 200 / SPA fallback / api/info / 信令 WS pong）；三视口（390/768/1440）无横向溢出
- **验证**：`npm run build` 产物 123KB JS（gzip 48KB）
- 全部 9 个模块开发完成，进入真机统一验证阶段

## 2026-08-15 · 真机验证通过 · v1.0.1

- **验证**：真机双设备实测通过（拍摄端+观看端）：实时画面、双向对讲、截图/录制、断线重连、动作/哭闹检测提醒、二维码配对均正常，无发现问题
- 项目 MVP 开发完成 ✅（9 模块 + 真机验证全部通过）

## 2026-08-15 · 文档优化 · v1.0.2

- **更新**：README 增加「🚀 日常启动」醒目入口（build + start 两条命令），首次配置与开发模式分层说明

## 2026-08-15 · 文档与代码一致性核对 · v1.0.3

- **新增**（文档滞后补实现）：PC 观看端快捷键——`S` 截图、`R` 录制、`F` 全屏（documentElement.requestFullscreen）、空格键按住说话（keydown/keyup 绑定，输入框内不拦截、e.repeat 防重复触发）
- **更新**（文档修正为实际实现）：原文档多处声称"≥1024px 桌面横向布局（视频 + 侧边控制栏）"，实际为居中宽布局 + 底部玻璃控制栏——README/需求文档/设计文档三处同步修正
- **更新**：CLAUDE.md 依赖清单补充 playwright/@playwright/mcp、开发命令补充 `npm run test:audio`
- **核对**：其余文档内容（信令协议/检测算法/重连分层/音视频参数/已知限制）与代码一致，无滞后
- **验证**：e2e 9/9 通过（快捷键不影响现有流程）
