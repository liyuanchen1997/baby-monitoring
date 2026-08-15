# 👶 宝宝监控（Baby Monitoring）

纯局域网 WebRTC 实时监控应用：一部设备（手机或 PC，放宝宝旁）用摄像头实时推流，另一部设备（家长）实时查看，支持双向语音对讲与**动作/哭闹检测提醒**。

**隐私不出家门**：媒体走 WebRTC 点对点直连（DTLS/SRTP 加密），信令仅在同一 WiFi 内中继，无任何公网服务器依赖。

## ✨ 功能特性

- 📹 **实时视频**：720p/24fps，后置摄像头优先，局域网内流畅观看
- 🎙 **双向语音对讲**：观看端按住说话（push-to-talk），可哄宝宝，防回声啸叫
- 📸 **截图 / ⏺ 录制**：观看端一键操作，PNG 截图 / mp4、webm 录制文件
- 🔔 **动作/哭闹检测提醒**：拍摄端实时检测，观看端横幅 + 声音 + 系统通知（灵敏度三档可调）
- 📱 **二维码配对**：拍摄端扫码直达观看端，或手动输入 6 位房间码
- 🔄 **连接保障**：断线自动重连（WS/ICE/媒体三层）、屏幕常亮、AP 隔离提示
- 💻 **双端适配**：手机（iOS/Android）与 PC 全支持，PC 观看端快捷键（S/R/F/空格）

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite（无 vue-router / pinia，URL query `?join=<code>` 驱动视图） |
| 后端 | Node.js + Express（静态服务 + `/api/info`）+ ws（WebSocket 信令） |
| 媒体 | WebRTC 点对点（拍摄端恒为唯一 offerer），STUN 仅用 Google 公共服务器，无 TURN |
| 二维码 | qrcode 库 |
| 证书 | mkcert 自签 HTTPS（含局域网 IP SAN，手机安装 rootCA） |

## 📁 项目结构

```
├── server/          # Node.js 后端（HTTPS + 静态服务 + WebSocket 信令）
│   ├── index.mjs    # 入口：/api/info、静态 dist/、SPA fallback
│   ├── signaling.mjs# 信令：房间管理、消息中继、心跳、检测状态缓存
│   └── lan.mjs      # 局域网 IP 检测
├── src/             # Vue 3 前端
│   ├── composables/ # useCamera / usePeerConnection / useSignaling / 检测与提醒等
│   ├── views/       # HomeView（首页）/ CameraView（拍摄端）/ ViewerView（观看端）
│   ├── components/  # 视频视图、连接徽标、二维码、对讲按钮、告警横幅等
│   ├── utils/       # frameDiff（动作检测）/ audio（哭声分析）
│   └── config.js    # 所有可调参数集中配置
├── scripts/         # cert（证书）/ serve-cert（CA 下载）/ dev（启动编排）
├── test/            # 冒烟测试 / 音频单元测试 / Playwright e2e
└── doc/             # 需求文档 / 设计文档 / 更新日志
```

## 🚀 快速开始

### 前置要求

- macOS（开发机）+ [Node.js](https://nodejs.org) ≥ 20
- [Homebrew](https://brew.sh)（用于安装 mkcert）
- 两台设备连同一 WiFi（手机 + 手机 / 手机 + PC）

### 1. 安装依赖

```bash
brew install mkcert nss    # HTTPS 证书工具（仅首次）
npm install
```

### 2. 生成 HTTPS 证书

手机浏览器调用摄像头**必须 HTTPS**（安全上下文限制），本项目用 mkcert 自签证书：

```bash
npm run cert    # 生成含 localhost + 全部局域网 IP 的证书
```

> macOS 本机绿锁（可选）：在终端运行 `mkcert -install` 将 CA 装入系统信任库。

### 3. 启动

**日常使用（生产模式）：**

```bash
npm run build
npm run start    # 终端会打印访问地址（Ctrl+C 停止）
```

**开发调试（热更新）：**

```bash
npm run dev      # 后端 :3443 + 前端 :5173
```

### 4. 手机安装证书（首次，每台手机一次）

```bash
npm run cert:serve    # 启动 CA 下载服务（端口被占用自动避让）
```

手机浏览器访问终端打印的地址（如 `http://192.168.x.x:8081`）下载 rootCA 并安装：

- **iPhone**：下载 → 设置 → 已下载描述文件 → 安装 → 设置 → 通用 → 关于本机 → 证书信任设置 → **开启完全信任**
- **Android**：**用 Firefox 下载**（Chrome 默认不信任用户 CA）→ 设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书

> ⚠️ 证书信任是设备级的：**每台手机都要安装一次**。

## 📱 使用指南

1. **拍摄端**（放宝宝旁的设备）：打开 `https://<电脑IP>:3443` → 点「开始监控」→ 允许摄像头/麦克风 → 得到 6 位房间码
2. **观看端**（家长设备）：手机相机扫码（点拍摄端「📱 二维码」按钮），或在首页输入房间码
3. **对讲**：观看端**按住**「🎙 说话」按钮（或 PC 按空格），声音经拍摄端扬声器外放
4. **截图/录制**：观看端控制栏 📸 / ⏺（PC 快捷键 `S` / `R`）
5. **提醒**：观看端点 🔔 开启——检测到哭闹/大幅动作时横幅 + 声音 + 系统通知
6. **灵敏度**：拍摄端监控卡片右上角可调（低/中/高），误报多时用「低」

> 💡 建议在放置拍摄手机**前**完成扫码配对；之后可用房间码手动输入。

## 🧪 测试

```bash
npm run smoke        # 信令生命周期冒烟测试（17 项断言）
npm run test:audio   # 音频分析纯函数单元测试（哭声检测核心算法）
npm run e2e          # Playwright 浏览器自动化（模拟摄像头，双标签互看+对讲+提醒，9 项断言）
```

e2e 使用确定性 y4m 测试视频模拟摄像头运动，可同时验证 dev（默认）与生产（`E2E_PORT=3443`）模式。

## ❓ 常见问题

**Q：手机访问提示证书警告？**
未安装或未完全信任 rootCA（见上文「手机安装证书」）；iOS 记得开启"证书信任设置"里的完全信任开关。

**Q：Android Chrome 打不开 / 摄像头被拒绝？**
Chrome 出于安全策略不信任用户安装的 CA——请用 **Firefox** 访问。

**Q：画面连不上，提示"AP 隔离"？**
路由器开启了客户端隔离（AP Isolation），请关闭该选项或更换网络。

**Q：拍摄端锁屏后画面停止？**
浏览器在锁屏/切后台时会关闭摄像头采集（Web 平台限制）。拍摄手机请设置**永不锁屏 + 插电 + 保持前台**。

**Q：经常误报哭闹？**
灵敏度调到「低」档，并调整摄像头摆放角度（避免正对窗帘/窗户/光源）。

## ⚠️ 已知限制

- 房间码 6 位数字无鉴权，局域网内可被猜测加入（家庭场景可接受）
- 哭声检测为启发式算法，无法 100% 准确；灵敏度分级 + 误报抑制是产品手段
- iOS Safari 不支持网页系统通知（仅前台横幅 + 声音）
- 检测误报源：窗帘飘动、窗外车辆、光影变化
- 录制全平台走 canvas 路径（iOS Safari 直录远程流有黑屏 bug，已规避）

## 📚 文档

- [需求文档](doc/需求文档.md) — 功能需求、验收标准
- [设计文档](doc/设计文档.md) — 架构、信令协议、检测算法、UI 规范
- [更新日志](doc/CHANGELOG.md) — 全部变更记录
- [开发协作文档](CLAUDE.md) — 面向开发者的模块划分与架构决策

## 📄 License

[MIT](LICENSE) © 2026 liyuanchen
