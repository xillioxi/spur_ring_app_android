# Yanqiang Voice Android SDK Bundle

这个目录是给新工程使用的研强录音戒指 Android SDK 迁移包。

目标工程：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice
```

来源工程：

```text
/Users/spur/X/lab/dreameApp_record/DreameRing
```

## 目录内容

```text
android/app/libs/
  aizo_serversdk_release_v2_2.2.6.aar
  aizo_sdk_release_v2.1.2.aar
  aizo_be_lib_release_v2.1.0.aar
  AliAgent-release-4.1.3.aar
  rtk-core-1.6.9.jar
  rtk-bbpro-core-1.6.1.jar
  rtk-dfu-3.12.32.jar

android/app/src/main/java/com/spur/recordingring/yanqiang/
  YanqiangVoiceModule.java
  YanqiangVoicePackage.kt

src/native/
  YanqiangVoiceNative.ts

android/snippets/
  app-build.gradle.patch.md
  MainApplication.kt.patch.md
  AndroidManifest.permissions.md
  js-usage-example.md

reference/
  RTCNativeModule.java
  RTCNativeRingModule.java
  NativeModulePackage.kt
  ServiceSdkCommandV2-recording-api-notes.md
```

## 复制方式

把本目录里的 `android/app/libs/*` 复制到目标工程：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android/app/libs/
```

把原生桥接代码复制到目标工程同路径：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android/app/src/main/java/com/spur/recordingring/yanqiang/
```

把 JS 调用入口复制到目标工程同路径：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/src/native/YanqiangVoiceNative.ts
```

然后按 `android/snippets/` 里的说明合并：

```text
android/app/build.gradle
android/app/src/main/java/com/spur/recordingring/MainApplication.kt
android/app/src/main/AndroidManifest.xml
```

## 重要说明

不要把旧工程 `DreameRing` 的 Android 代码整包复制到新 App。旧工程包含健康、运动、ECG、OTA、震动、玉成、杰理、友盟等大量无关逻辑。

新 App 建议新建轻量 NativeModule，只封装研强录音相关能力：

```text
initSdk
scanDevices
connect
disconnect
queryVoiceRecordingSummary
syncVoiceRecordings
getVoiceRecordParam
setVoiceRecordParam
```

本迁移包已提供第一版轻量桥接：

```text
android/app/src/main/java/com/spur/recordingring/yanqiang/YanqiangVoiceModule.java
android/app/src/main/java/com/spur/recordingring/yanqiang/YanqiangVoicePackage.kt
src/native/YanqiangVoiceNative.ts
```

NativeModule 名称：

```text
YanqiangVoiceModule
```

RN 事件名：

```text
yanqiangVoiceScanEvent
yanqiangVoiceConnectionChanged
yanqiangVoiceStatusUpdate
yanqiangVoiceSyncState
yanqiangVoiceSyncProgress
yanqiangVoiceFileReady
yanqiangVoiceError
```

底层 SDK 主入口：

```java
com.eiot.ringsdk.ServiceSdkCommandV2
```

录音相关 SDK 能力包括：

```text
registerDeviceWorkingStateListener
getDeviceStorageState
getVoiceRecordFile
opusToOgg
getVoiceRecordParam
setVoiceRecordParam
```

## SDK 初始化关键点

旧工程初始化在 `reference/RTCNativeModule.java` 的 `setupVendor` 方法里。核心调用是：

```java
ServiceSdkCommandV2.INSTANCE.init(
    application,
    1,
    BuildConfig.VERSION_NAME,
    "Dreame Ring",
    BuildConfig.APPLICATION_ID,
    "CN",
    "ZH",
    "",
    true
);
```

旧工程注释说明 `"Dreame Ring"` 不建议随意修改，避免研强戒指重连异常。迁移到新 App 时先保持这个值。

## 当前包状态

本迁移包当前已包含：

```text
1. SDK libs
2. README.md
3. Gradle/MainApplication/Manifest 修改说明
4. 旧工程参考代码
5. 第一版 YanqiangVoiceModule / YanqiangVoicePackage / JS Native wrapper
```

其中三个 `rtk-*.jar` 是 aizo SDK 初始化所需的 Realtek 传递依赖。由于本地
AAR 通过 `flatDir` / `fileTree` 引入，不携带 Maven 传递依赖信息，必须随迁移包
一起复制；否则初始化会因找不到 `com.realsil.sdk.core.RtkConfigure` 等类而失败。
