# 宝宝监控（Baby Monitoring）项目文档

## 项目简介

WebRTC 实时监控网站应用：一部设备（拍摄端，手机/PC，放宝宝旁）用摄像头实时推流，另一部设备（观看端，家长）实时查看。纯局域网场景（同一 WiFi），支持 **PC 端与移动端** 双端使用。

核心功能：实时视频、双向语音对讲、观看端截图/录制、断线自动重连、**动作/哭闹检测提醒**。

## 技术栈

- 前端：Vue 3 + Vite（无 vue-router、无 pinia，URL query `?join=<code>` 驱动视图分发）
- 后端：Node.js + Express（静态服务 + `/api/info`）+ ws（WebSocket 信令）
- 媒体：WebRTC 点对点（拍摄端恒为唯一 offerer），STUN 仅用 Google 公共服务器，无 TURN
- 二维码：`qrcode` 库
- 依赖清单：`express`、`ws`、`qrcode`；devDeps：`vite`、`@vitejs/plugin-vue`、`vue`

## 开发流程（重要约定）

1. **分模块开发**：按下方模块顺序逐个开发，**每个模块开发完成并验证后必须停止**，等待用户确认后再进行下一个模块
2. **更新日志**：每次变更（新增/更新/修改/修复）必须记录到 `doc/CHANGELOG.md`，格式见该文件
3. **文档同步**：改动涉及架构、协议、参数时，同步更新 `doc/设计文档.md` 与 `doc/需求文档.md`；用户使用方式变化时更新 `README.md`
4. **每模块提交**：每个模块完成时，先确保相关文档已更新到最新（README / CLAUDE.md / doc 三件套），然后 `git add -A` + `git commit`（commit message 简洁英文附带简洁中文）；提交前向用户展示变更摘要
5. git push / rebase / 强制操作仍需用户明确要求

## 模块划分（按顺序开发，完成一个 → 等确认 → 下一个）

| 模块 | 内容 | 验证标准 | 状态 |
|---|---|---|---|
| 0 项目初始化与文档 | 骨架 + CLAUDE.md/README.md/doc 三件套 | dev 出页 | ✅ 进行中 |
| 1 HTTPS 证书与环境 | cert.mjs/serve-cert.mjs/lan.mjs/dev.mjs，mkcert | macOS 绿锁、LAN IP 可访问 | ⬜ |
| 2 信令服务器与页面骨架 | signaling.mjs、useSignaling.mjs、三视图骨架 | smoke 测试通过 | ⬜ |
| 3 媒体链路 | 摄像头采集、PeerConnection、视频视图、连接状态 | 双标签页互看 | ⬜ |
| 4 对讲/截图/录制 | TalkButton、useScreenshot、useRecorder | 双端功能可用 | ⬜ |
| 5 连接保障 | Wake Lock、重连分层（WS/ICE/媒体）、AP 隔离提示 | 飞行模式重连 | ⬜ |
| 6 二维码配对 | QrOverlay、/api/info、?join= 预填 | 扫码直开观看端 | ⬜ |
| 7 动作/哭闹检测 | frameDiff/audio utils、两个检测器、状态机、灵敏度 | 哭声触发/光照不误报 | ⬜ |
| 8 观看端提醒 | useNotifier、AlertBanner、离线补发 | 横幅+声音+通知 | ⬜ |
| 9 打磨与收尾 | 响应式细节、README 完善、生产链路 | build+start 全流程 | ⬜ |

## 关键架构决策（修改前先读）

- **HTTPS 必须**：`getUserMedia` 只在安全上下文可用。手机访问局域网 IP 需 mkcert 自签证书（含 LAN IP SAN）+ 手机安装 rootCA。开发模式 vite 同样启用 https（`certs/` 存在时）。
- **检测在拍摄端**：动作/哭声检测跑在拍摄端（传感器源头），结果经信令 WS 推送观看端；同一媒体流被 addTrack / AudioContext 哭声分析 / canvas 动作分析三方共享消费，互不冲突。
- **拍摄端恒为唯一 offerer**：观看端只应答，避免 glare，无需 perfect negotiation。
- **信令只中继不存 SDP**：服务器只做房间管理 + 中继 + activity 最新状态缓存（不做事件持久化）。
- **房间生命周期绑定拍摄端 WS 存活**：拍摄端断开即删房；观看端断开仅清槽位，房间保留。
- **重连三层独立状态机**：L0 WS 指数退避重连（带恢复码重建房）；L1 ICE restartIce/整体重建；L2 媒体冻结检测。
- **录制全平台走 canvas 兜底路径**：iOS Safari 直录远程流有黑屏 bug。
- **可调参数全部集中 `src/config.js`**：分辨率/码率/检测阈值/灵敏度三档预设。
- **PC 端支持**：UI 响应式（≥1024px 桌面横向布局 / 移动竖屏大按钮 + 底部操作栏 + 安全区）；TalkButton 兼容 touch/mouse；PC 观看端快捷键（截图/录制/全屏/对讲）；PC 摄像头同样可作拍摄端。

## 开发命令

```bash
npm install          # 安装依赖
npm run cert         # 生成 HTTPS 证书（需先 brew install mkcert nss）
npm run dev          # 启动开发环境（server:3443 + vite:5173，自动检测 LAN IP 并打印访问 URL）
npm run build        # 前端构建
npm run start        # 生产模式（server 直接 serve dist）
npm run smoke        # 信令生命周期冒烟测试
```

## 手机证书安装要点（详见 README）

- iOS：下载描述文件 → 安装 → 设置→通用→关于本机→证书信任设置→完全信任
- Android：Chrome 默认不信任用户 CA → 用 Firefox；或 Chrome flag（仅开发用）

## 已知限制（设计边界，勿当作 bug）

- 房间码 6 位数字无鉴权，局域网内可被猜测加入（MVP 可接受，后续可加 PIN）
- iOS 锁屏/切后台会关闭摄像头采集（Web 平台限制）：拍摄端须保持前台+插电+永不锁屏
- 哭声检测是启发式算法，无法 100% 准确；灵敏度分级+误报抑制是产品手段
- iOS Safari 不支持网页 Notification API（仅横幅+声音）
- 检测误报源：窗帘飘动、窗外车辆、光影变化（低灵敏度档+调整摆放角度缓解）
