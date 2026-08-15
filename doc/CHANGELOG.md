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
