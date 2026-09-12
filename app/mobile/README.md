# Recording Ring RN

Android-first、兼容 iOS 的 React Native 前端工程。它不是 WebView，而是根据 `../Recording-H5` 的页面、类型、mock 和 API 逻辑重写出的 RN APP。

## 当前范围

- 录音列表
- 录音摘要
- 逐字稿
- AI 助手聊天
- AI Agent 提醒
- 录音戒指设备页
- 硬件通信抽象层：当前默认 `MockRingTransport`

## 推荐运行方式

本工程预留了 BLE 能力，因此使用 Expo Development Build，不使用 Expo Go。

```bash
npm install
npm run android
```

## Windows / Android Studio

1. Install Node.js 20 and Android Studio with Android SDK 35.
2. Run `npm ci` in this `mobile` directory.
3. Open the `mobile/android` directory in Android Studio (not the repository root).
4. Let Gradle sync finish, select a connected Android device, and run the `app` configuration.

The Gradle project resolves Node from `NODE_BINARY` when that environment
variable is set, otherwise it uses `node` from `PATH`. This keeps the same
Android project usable on Windows, macOS, Linux, and CI.

Windows builds stage native library files under `android/.cxx` to avoid excessively
long paths beneath `node_modules`. CMake/Ninja can otherwise report
`build.ninja still dirty after 100 tries` for generated React Native prefab files.
For especially long checkout paths, also use a short drive mapping. Choose an
unused drive letter, for example:

```powershell
subst S: "C:\path\to\Spur Ring App"
cd S:\Spur_ring-main\app\mobile\android
.\gradlew.bat :app:assembleRelease :app:bundleRelease
# After Gradle exits, return to another drive before removing the mapping:
cd C:\
subst S: /D
```

Run `npm run typecheck` and `npm test` in `app/mobile` to validate the TypeScript
source and document generation success, failure, and cancel/retry behavior.

iOS 后续可用：

```bash
npm run ios
```

## 硬件接入点

真实戒指协议接入时，优先替换：

- `src/hardware/bleRingTransport.ts`
- `src/hardware/ringProtocol.ts`
- `src/hardware/ringService.ts`

当前已知音频参数来自项目文档：

- PCM
- `s16le`
- `8000Hz`
- 单声道

## 下一步需要硬件侧确认

- BLE 广播名或过滤规则
- Service UUID / Characteristic UUID
- 命令码和包结构
- 文件列表协议
- 文件分片下载协议
- ACK / CRC / 重试 / 断点续传
- 时间同步、电量、删除录音、OTA 协议
