#!/bin/bash
set -euo pipefail
SDK_SIM=$(xcrun --sdk iphonesimulator --show-sdk-path)
NATIVE="/Users/zexuansun/X/space/spur/app/mobile/native-sdk"
STUB_ROOT="$NATIVE/simulator-frameworks"
rm -rf "$STUB_ROOT"
mkdir -p "$STUB_ROOT"

make_stub() {
  local name="$1"
  local dir="$STUB_ROOT/${name}.framework"
  mkdir -p "$dir/Headers" "$dir/Modules"
  cat > "$dir/Headers/${name}.h" <<EOF
#import <Foundation/Foundation.h>
@interface ${name}Stub : NSObject
@end
EOF
  cat > "$dir/Modules/module.modulemap" <<EOF
framework module ${name} {
  umbrella header "${name}.h"
  export *
  module * { export * }
}
EOF
  cat > "$STUB_ROOT/${name}_stub.c" <<EOF
void ${name}_simulator_stub(void) {}
EOF
  xcrun clang -arch arm64 \
    -target arm64-apple-ios15.1-simulator \
    -isysroot "$SDK_SIM" \
    -dynamiclib \
    -o "$dir/${name}" \
    "$STUB_ROOT/${name}_stub.c" \
    -install_name "@rpath/${name}.framework/${name}" \
    -framework Foundation
  /usr/bin/plutil -create xml1 "$dir/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :CFBundleExecutable string ${name}" "$dir/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.spur.stub.${name}" "$dir/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :CFBundleName string ${name}" "$dir/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :CFBundlePackageType string FMWK" "$dir/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string 1.0" "$dir/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string 1" "$dir/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :MinimumOSVersion string 15.1" "$dir/Info.plist"
  echo "Built stub $name"
  file "$dir/${name}"
}

make_stub RingSDK
make_stub AB_FOTA

rm -rf "$NATIVE/RingSDK.xcframework" "$NATIVE/AB_FOTA.xcframework"
xcodebuild -create-xcframework \
  -framework "$NATIVE/RingSDK.framework" \
  -framework "$STUB_ROOT/RingSDK.framework" \
  -output "$NATIVE/RingSDK.xcframework"
xcodebuild -create-xcframework \
  -framework "$NATIVE/AB_FOTA.framework" \
  -framework "$STUB_ROOT/AB_FOTA.framework" \
  -output "$NATIVE/AB_FOTA.xcframework"
echo "XCFRAMEWORKS_OK"
find "$NATIVE/RingSDK.xcframework" -type f -name 'RingSDK' -exec file {} \;
