#import "YanqiangVoiceModule.h"

/**
 * Simulator-only stub.
 * Vendor RingSDK.framework / AB_FOTA.framework ship device (iphoneos) arm64 only,
 * so the real YanqiangVoiceModule.m cannot compile or link for iphonesimulator.
 * UI / Recordings / AI Assistant demos still run; BLE ring APIs no-op on simulator.
 */
@implementation YanqiangVoiceModule

RCT_EXPORT_MODULE(YanqiangVoiceModule)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[
    @"YanqiangScanResult",
    @"YanqiangConnectionState",
    @"YanqiangAuthState",
    @"YanqiangTouchEvent",
    @"YanqiangRecordingSyncProgress",
    @"YanqiangRecordingSyncFile",
    @"YanqiangLog"
  ];
}

- (void)startObserving {}
- (void)stopObserving {}

static void RejectSimulator(RCTPromiseRejectBlock reject, NSString *code)
{
  if (reject) {
    reject(code ?: @"YANQIANG_SIMULATOR",
           @"RingSDK is unavailable on iOS Simulator (device-only vendor framework).",
           nil);
  }
}

RCT_REMAP_METHOD(initSdk,
                 initSdkWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (resolve) {
    resolve(@{ @"ok" : @YES, @"simulator" : @YES });
  }
}

RCT_REMAP_METHOD(startScan,
                 startScanWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  RejectSimulator(reject, @"YANQIANG_SCAN_UNSUPPORTED");
}

RCT_EXPORT_METHOD(stopScan) {}

RCT_REMAP_METHOD(connect,
                 connectWithMac:(NSString *)mac
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  RejectSimulator(reject, @"YANQIANG_CONNECT_UNSUPPORTED");
}

RCT_REMAP_METHOD(disconnect,
                 disconnectWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (resolve) {
    resolve(@{ @"ok" : @YES, @"simulator" : @YES });
  }
}

RCT_REMAP_METHOD(setTouchEventReporting,
                 setTouchEventReporting:(BOOL)enabled
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (resolve) {
    resolve(@{ @"ok" : @YES, @"enabled" : @(enabled), @"simulator" : @YES });
  }
}

RCT_REMAP_METHOD(queryVoiceRecordingSummary,
                 queryVoiceRecordingSummaryWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (resolve) {
    resolve(@{ @"count" : @0, @"simulator" : @YES });
  }
}

RCT_REMAP_METHOD(syncVoiceRecordings,
                 syncVoiceRecordingsWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  RejectSimulator(reject, @"YANQIANG_SYNC_UNSUPPORTED");
}

RCT_REMAP_METHOD(getVoiceRecordParam,
                 getVoiceRecordParamWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (resolve) {
    resolve(@{ @"simulator" : @YES });
  }
}

RCT_REMAP_METHOD(setVoiceRecordParam,
                 setVoiceRecordParamWithParams:(NSDictionary *)params
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (resolve) {
    resolve(@{ @"ok" : @YES, @"simulator" : @YES });
  }
}

@end
