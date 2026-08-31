# Spur Recording Ring

录音戒指 App 主工程（从 `claudeV2` 的 App / 云端 / 硬件相关目录抽离）。

原 `claudeV2` 继续作为 Claude Code 智能体编排仓库；**本仓库是未来 App + 云端 + 部分硬件的主开发目录**。

## 目录结构

```text
spur/
├── mobile/                 # React Native / Expo 移动端
│   ├── android/            # Android 原生工程
│   ├── ios/                # iOS（占位，后续 prebuild）
│   ├── src/                # JS/TS 业务代码
│   ├── native-sdk/         # 研强 / 厂商 BLE SDK 归档
│   ├── App.tsx
│   ├── app.json
│   └── package.json
├── cloud/
│   └── audio-agent/        # 云端音频转写 / Agent API
├── web/
│   └── Recording-H5/       # H5 录音相关前端
├── hardware/
│   └── 3_boardring/        # 戒指固件 / 板级工程
├── docs/                   # 产品、构建、联调文档
├── archive/
│   └── app_RN/             # 旧 RN 参考工程（非主开发）
└── README.md
```

## 来源映射

| 新路径 | 旧路径（claudeV2） |
|--------|-------------------|
| `mobile/` | `app_front/app_yanqiang_voice/` |
| `cloud/audio-agent/` | `apps/audio-agent/` |
| `web/Recording-H5/` | `app_front/Recording-H5/` |
| `hardware/` | `hardware/` |
| `docs/` | `apps/docs/` |
| `archive/app_RN/` | `app_front/app_RN/` |

复制时已排除：`node_modules`、Android `build` 产物、硬件 `build-arm` 等。

## 快速开始（Android）

```bash
cd mobile
npm install   # 或 bun install
cd android
./gradlew :app:assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

更完整的安装说明见 `docs/andriod_app/`。

## iOS

当前以 Android 为主。生成 iOS 工程：

```bash
cd mobile
npx expo prebuild --platform ios
```

详见 `mobile/ios/README.md`。

## 云端

```bash
cd cloud/audio-agent
# 按该目录内 README / docs 启动
```

## 说明

- **不要**再把 App 主开发继续堆回 `claudeV2`。
- `mobile/yanqiang_voice_android_sdk_bundle` 与 `mobile/native-sdk/` 内容同源；构建仍以 `android/app/libs` 为准。
- 本目录为**复制抽离**，未删除 `claudeV2` 源文件；确认无误后再在旧仓库清理 App 目录。
