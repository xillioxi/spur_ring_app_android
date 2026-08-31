//
//  BTIntervalModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/6/21.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 用于管理设备支持的测量间隔的模型。
/// Model used to manage measurement intervals supported by the device.
@interface BTIntervalModel : NSObject

/// 当前设备设置的测量间隔时间，单位为分钟。
/// The current measurement interval set on the device, in minutes.
@property (nonatomic, assign) NSUInteger currentInterval;

/// 设备推荐的默认测量间隔时间，单位为分钟。
/// The default measurement interval recommended by the device, in minutes.
@property (nonatomic, assign) NSUInteger defaultInterval;

/// 设备支持的所有测量间隔列表，单位为分钟。
/// A list of all measurement intervals supported by the device, in minutes.
@property (nonatomic, strong) NSArray<NSNumber *> *supportedIntervals;

/// 使用指定的数据初始化BTIntervalModel的新实例。
/// Initializes a new instance of BTIntervalModel with the specified data.
/// @param data 包含间隔信息的NSData对象。The NSData object containing the interval information.

/// @return BTIntervalModel的实例。
/// @return An instance of BTIntervalModel.
- (instancetype)initWithData:(NSData *)data;

@end

NS_ASSUME_NONNULL_END
