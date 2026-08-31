# AndroidManifest 权限说明

目标文件：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android/app/src/main/AndroidManifest.xml
```

目标工程当前已经具备大部分蓝牙和录音权限：

```xml
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.VIBRATE"/>
```

研强 SDK 走 BLE 连接、扫描和文件同步时，重点确认运行时已申请：

```text
Android 12+:
  BLUETOOTH_SCAN
  BLUETOOTH_CONNECT

Android 6-11:
  ACCESS_FINE_LOCATION
```

如果 SDK 或文件保存逻辑只写 App 私有目录，不需要额外外部存储权限。

目标工程当前已有 `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`，第一轮可保留。
