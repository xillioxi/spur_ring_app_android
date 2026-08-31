# ServiceSdkCommandV2 录音相关 API 备忘

SDK 文件：

```text
android/app/libs/aizo_serversdk_release_v2_2.2.6.aar
```

主类：

```java
com.eiot.ringsdk.ServiceSdkCommandV2
```

## 初始化

旧工程参考：

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

## 连接相关

通过 `javap` 反查到的公开方法包括：

```java
searchBtDevice(...)
stopSearchBtDevice()
connect(String macAddress)
disconnect(BCallback callback)
addCallback(AizoDeviceConnectCallback callback)
removeCallback(AizoDeviceConnectCallback callback)
requestConnectionPriority()
```

## 录音状态

```java
registerDeviceWorkingStateListener(DeviceWorkingStateCallback callback)
unregisterDeviceWorkingStateListener(DeviceWorkingStateCallback callback)
```

回调类型：

```java
com.eiot.ringsdk.callback.DeviceWorkingStateCallback
```

数据对象：

```java
com.eiot.ringsdk.bean.device.DeviceWorkingState
```

字段：

```java
getFunction()
getState()
getRemainingTime()
```

## 设备录音存储

```java
getDeviceStorageState(int function, DeviceStorageStateCallback callback)
```

录音文件类型按旧文档和 SDK 约定使用：

```java
function = 1
```

回调类型：

```java
com.eiot.ringsdk.callback.DeviceStorageStateCallback
```

数据对象：

```java
com.eiot.ringsdk.bean.device.DeviceStorageState
```

字段：

```java
getFunction()
getDataNumber()
getDataTotalBytes()
```

## 拉取录音文件

```java
getVoiceRecordFile(boolean resumeOnly, VoiceRecordCallback callback)
```

经反编译和真机日志确认，这个布尔值不是 `syncAll`：

```text
true  = 只尝试恢复 SDK 本地缓存中的未完成传输；无匹配缓存时返回 code=2/Failed
false = 正常同步；有未完成文件则续传，否则查询并启动新的文件上传
```

App 发起正常录音同步时必须传 `false`。

回调类型：

```java
com.eiot.ringsdk.callback.VoiceRecordCallback
```

回调方法：

```java
onStart(VoiceRecordResultBean result)
onProgress(FileUploadStateBean state)
onReceive(OpusFileBean opusFile)
onFinish(VoiceRecordResultBean result)
```

## Opus 文件对象

```java
com.eiot.ringsdk.bean.OpusFileBean
```

字段：

```java
getFileName()
getFileTime()
getFileVersion()
getChannelCount()
getSampleFrequency()
getFrameDuration()
getFrameSize()
getBitRate()
getFileBytes()
```

## 转 OGG

```java
opusToOgg(OpusFileBean opusFile, OggFileCallback callback)
```

目标 NativeModule 可以在 `onReceive(OpusFileBean)` 后调用 `opusToOgg`，把结果保存到：

```text
context.getFilesDir()/voice-recordings/
```

然后向 RN 发送：

```text
voiceRecordingFileReady
```

事件字段建议：

```ts
{
  name: string
  uri: string
  timestamp: number
  size: number
}
```
