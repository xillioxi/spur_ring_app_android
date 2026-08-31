//
//  LogManager.h
//  RingSDK
//
//  Created by Kaoji on 2024/6/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// NOTE: The original enum was named `LogLevel` with cases
// `LogLevelDebug/Warning/Error`. This conflicts with `iOSDFULibrary`
// (NordicDFU)'s Swift `@objc enum LogLevel` which generates an
// Objective-C `enum LogLevel` with cases `LogLevelVerbose/Info/...`.
// When both modules are imported in the same translation unit, the
// compiler reports duplicate-definition errors such as:
//   'LogLevelVerbose' from module 'NordicDFU.Swift' is not present in
//   definition of 'enum LogLevel' in module 'RingSDK.LogManager'
// To avoid the clash we namespace this enum with a `RingSDK` prefix.
// The underlying integer values are unchanged so the binary ABI of
// `-[LogManager logMessage:level:]` remains compatible.

typedef NS_ENUM(NSUInteger, RingSDKLogLevel) {
    RingSDKLogLevelDebug   = 0,
    RingSDKLogLevelWarning = 1,
    RingSDKLogLevelError   = 2
};

// Debug
#define DLog(fmt, ...) [LogManager.sharedManager logMessage:[NSString stringWithFormat:(fmt), ##__VA_ARGS__] level:RingSDKLogLevelDebug]

// Warning Log
#define WLog(fmt, ...) [LogManager.sharedManager logMessage:[NSString stringWithFormat:(fmt), ##__VA_ARGS__] level:RingSDKLogLevelWarning]

// Error Log
#define ELog(fmt, ...) [LogManager.sharedManager logMessage:[NSString stringWithFormat:(fmt), ##__VA_ARGS__] level:RingSDKLogLevelError]

@interface LogManager : NSObject
@property (nonatomic, assign) BOOL isLoggingEnabled;

+ (instancetype)sharedManager;
- (void)enableLogging;
- (void)disableLogging;
- (void)logMessage:(NSString *)message level:(RingSDKLogLevel)level;
- (NSString *)logPath;
- (void)clearLogs;
@end

NS_ASSUME_NONNULL_END
