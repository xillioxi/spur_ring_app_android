//
//  BTMeasureResult.h
//  RingSDK
//
//  Created by kaoji on 5/28/24.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BodyCompostionPacket.h>
NS_ASSUME_NONNULL_BEGIN

/**
 BTMeasureResult class represents a measurement result.
 BTMeasureResult类表示测量结果。
 */
@interface BTMeasureResult : NSObject

/// 测量时间戳 (秒)。
/// Measurement timestamp in iseconds.
@property (nonatomic, assign) NSInteger measurementTime;

/// 测量结果，保留一位小数。0 或 -1 代表测量失败
/// Measurement result, one decimal place. 0 or -1 means a failure to measure.
@property (nonatomic, assign) float measurementResult;

/// 测量类型。
/// Type of measurement.
@property (nonatomic, assign) BTMeasureType measureType;

//MARK: -身体成分模型
@property (nonatomic, strong) BodyCompostionPacket *packet;

/**
 Initializes a new measurement result.

 @param time 测量时间。
 @param result 测量结果。
 @param type 测量类型。
 Initializes with measurement time, result, and type.
 */
- (instancetype)initWithMeasurementTime:(NSInteger)time
                        measurementResult:(float)result
                             measureType:(BTMeasureType)type;

/**
 Converts measurement result to a JSON string.
 转换测量结果为JSON字符串。
 */
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
