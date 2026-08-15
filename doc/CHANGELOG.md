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
