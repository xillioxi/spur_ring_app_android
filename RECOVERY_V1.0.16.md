# SPUR Ring 1.0.16 recovery

This branch preserves the source state corresponding to the supplied Android
package `spur-ring-process-capture-v1.0.16.apk`.

## Source artifact

- App version: `1.0.16`
- Android version code: `18`
- Package: `com.spur.recordingring`
- APK SHA-256: `BB64DD317F98DC48492645CF36B7CED7B1A53CC722E76F3124C200669A941AA4`

The APK itself is not committed. Its manifest, bundled JavaScript strings, and
native Android bytecode were inspected locally to recover the matching behavior
without disturbing later source work.

## Recovered state

- Home, Notes, Processes, device, settings, demo content, and detail views match
  the 1.0.16 application state.
- Ring long-press/release captures a voice command into Processes.
- Short recordings remain ordinary notes; command WAV recordings are routed to
  the audio agent workflow.
- Quick notes, result overlay, foreground notifications, and accessibility
  capture support are restored.
- Features added after 1.0.16, including recovery export, live native connection
  status, automatic note processing, and the newer text-insertion capture route,
  are intentionally excluded.

## Verification

The recovered source passes:

```text
npm run typecheck
npm test
gradlew :app:compileDebugJavaWithJavac --no-daemon
```

The native compile completed successfully using the Android SDK. Dependency
deprecation warnings are inherited from the Expo/React Native toolchain and do
not prevent the build.
