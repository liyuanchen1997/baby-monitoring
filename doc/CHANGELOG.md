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
