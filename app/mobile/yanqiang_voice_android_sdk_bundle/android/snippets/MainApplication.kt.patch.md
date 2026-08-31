# MainApplication.kt 合并说明

目标文件：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android/app/src/main/java/com/spur/recordingring/MainApplication.kt
```

目标工程当前包名：

```text
com.spur.recordingring
```

## 注册 NativePackage

后续新增 `YanqiangVoicePackage` 后，在 `getPackages()` 中手动添加。

示例：

```kotlin
import com.spur.recordingring.yanqiang.YanqiangVoicePackage

override fun getPackages(): List<ReactPackage> {
  val packages = PackageList(this).packages
  packages.add(YanqiangVoicePackage())
  return packages
}
```

不要复制旧工程的 `NativeModulePackage.kt` 到目标工程直接使用。旧工程注册了很多无关模块：

```text
RTCNativeModule
RTCNativeRingModule
RTCNativeYCRingModule
AppUpdateNativeModule
NativeMusicPlayingListenerModule
AndroidBackgroundSettingsModule
ECG ViewManager
通知图标 ViewManager
```

目标工程只需要注册新建的研强录音模块。

## SDK 初始化位置

建议在 JS 主动调用 `YanqiangVoiceModule.initSdk()` 时初始化 SDK，而不是在 `Application.onCreate()` 里直接初始化。

原因：

```text
1. RN 页面可以控制初始化时机
2. 方便返回初始化结果给 JS
3. 避免应用启动阶段过早触发蓝牙/权限相关逻辑
```

旧工程初始化参考：

```text
reference/RTCNativeModule.java
```
