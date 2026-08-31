//
//  ECGValue.h
//  AIZOSDK
//
//  Created by kaoji on 9/26/23.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTECGValue : NSObject

// 心电信号的测量值，通常单位为毫伏(mV)。
// Measurement value of the ECG signal, usually in millivolts (mV).
@property (nonatomic, assign) float value;

/// 当前分包序号（2字节，U16，从1开始编号）。
/// Current packet number, starting from 1, represented as a 16-bit unsigned integer.
@property (nonatomic, assign) uint16_t currentPktNum;

// 从测量开始到当前数据点的时间偏移，单位为毫秒。
// Time offset from the start of the measurement to this data point, in milliseconds.
@property (nonatomic, assign) uint64_t offset;

// 测量开始的UNIX时间戳，单位为毫秒。
// UNIX timestamp for the start of the measurement, in milliseconds.
@property (nonatomic, assign) uint64_t startTimestamp;

/// 采样率（2字节，U16，单位为Hz）。
/// Sample rate in Hertz, represented as a 16-bit unsigned integer.
@property (nonatomic, assign) uint16_t sampleRate;

// 计算从1970年1月1日以来的完整UNIX时间戳，单位为秒。
// Calculate the complete UNIX timestamp since January 1, 1970, in seconds.
- (NSTimeInterval)realTimestamp;
@end

NS_ASSUME_NONNULL_END
