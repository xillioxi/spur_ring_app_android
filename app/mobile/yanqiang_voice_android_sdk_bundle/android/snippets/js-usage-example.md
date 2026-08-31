# JS 调用示例

复制文件：

```text
src/native/YanqiangVoiceNative.ts
```

到目标工程：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/src/native/YanqiangVoiceNative.ts
```

## 最小调用

```ts
import {
  YanqiangVoiceNative,
  YanqiangVoiceEvents,
  YanqiangVoiceEventNames,
} from './src/native/YanqiangVoiceNative'

async function setup() {
  await YanqiangVoiceNative.initSdk()

  const scanSub = YanqiangVoiceEvents?.addListener(
    YanqiangVoiceEventNames.scan,
    event => {
      console.log('scan event', event)
    },
  )

  const connectionSub = YanqiangVoiceEvents?.addListener(
    YanqiangVoiceEventNames.connection,
    event => {
      console.log('connection event', event)
    },
  )

  const progressSub = YanqiangVoiceEvents?.addListener(
    YanqiangVoiceEventNames.syncProgress,
    event => {
      console.log('sync progress', event)
    },
  )

  const fileSub = YanqiangVoiceEvents?.addListener(
    YanqiangVoiceEventNames.fileReady,
    event => {
      console.log('file ready', event)
    },
  )

  YanqiangVoiceNative.startScan()

  return () => {
    scanSub?.remove()
    connectionSub?.remove()
    progressSub?.remove()
    fileSub?.remove()
  }
}
```

## 连接和同步

```ts
await YanqiangVoiceNative.connect(macAddress)

const summary = await YanqiangVoiceNative.queryVoiceRecordingSummary()
console.log('recording summary', summary)

const result = await YanqiangVoiceNative.syncVoiceRecordings()
console.log('local ogg files', result.files)
```

录音文件会保存到 Android App 私有目录：

```text
files/voice-recordings/*.ogg
```
