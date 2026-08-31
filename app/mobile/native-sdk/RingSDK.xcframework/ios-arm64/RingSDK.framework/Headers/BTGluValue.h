//
//  BTGluValue.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/8/28.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// `BTGluValue` 表示一个血糖数据点，包含了测量的原始值及其时间信息。
@interface BTGluValue : NSObject

/// 原始数据的十六进制字符串表示。
@property (nonatomic, copy) NSString *hexString;

/// 血糖测量值，整数形式。
@property (nonatomic, assign) NSInteger value;

/// 从开始测量时间的偏移量，以毫秒为单位。
@property (nonatomic, assign) NSInteger offset;

/// 测量的开始时间戳，单位为毫秒。
@property (nonatomic, assign) NSInteger startTimestamp;

/// 实际数据点的时间字符串，格式为 "HH:mm:ss"。
@property (nonatomic, copy) NSString *timeString;

/// 实际数据点的时间字符串，格式为 "HH:mm:ss"。
@property (nonatomic, assign, readonly) NSTimeInterval realTimestamp;

@end

NS_ASSUME_NONNULL_END
