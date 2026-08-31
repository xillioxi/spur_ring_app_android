# app/build.gradle 合并说明

目标文件：

```text
/Users/spur/X/space/claudeV2/app_front/app_yanqiang_voice/android/app/build.gradle
```

## 1. 增加 flatDir

在 `android { ... }` 代码块外面增加：

```gradle
repositories {
    flatDir {
        dirs 'libs'
    }
}
```

旧工程使用该配置让 Gradle 能解析 `android/app/libs` 里的本地 `.aar` / `.jar`。

## 2. 增加 libs 依赖

在 `dependencies { ... }` 内增加：

```gradle
implementation fileTree(dir: 'libs', include: ['*.jar', '*.aar'])
```

## 3. 可选依赖

如果编译提示缺少 AndroidX / Kotlin / util 依赖，再按错误补充。旧工程包含过这些依赖：

```gradle
implementation 'androidx.core:core-ktx:1.8.0'
implementation 'androidx.appcompat:appcompat:1.2.0'
implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.4.2'
implementation 'com.alibaba:fastjson:1.1.72.android'
implementation 'com.blankj:utilcodex:1.30.6'
```

第一轮建议只加 `flatDir` 和 `fileTree`，用编译错误驱动补依赖，避免引入无关包。

## 4. packagingOptions

如果后续出现 `.so` 重复冲突，再在 `android { packagingOptions { ... } }` 里加：

```gradle
packagingOptions {
    pickFirst 'lib/x86/libc++_shared.so'
    pickFirst 'lib/x86_64/libc++_shared.so'
    pickFirst 'lib/arm64-v8a/libc++_shared.so'
    pickFirst 'lib/armeabi-v7a/libc++_shared.so'
}
```

目标工程当前是 Expo/RN 结构，先不要直接覆盖原有 `packagingOptions`。
