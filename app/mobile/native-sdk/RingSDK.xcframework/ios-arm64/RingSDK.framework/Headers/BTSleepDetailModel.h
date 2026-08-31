//
//  BTSleepDetailModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/29.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 睡眠详情模型类
/// Model class for sleep detail
@interface BTSleepDetailModel : NSObject

/// 当天睡眠开始的时间戳
/// Start timestamp of the sleep for the day
@property (nonatomic, assign) NSUInteger startTimestamp;

/// 当天睡眠开始的时间字符串
/// Start time string of the sleep for the day
@property (nonatomic, strong) NSString *startTimeStr;

/// 睡眠类型
/// Sleep mode type
@property (nonatomic, assign) SleepMode sleepMode;

/// 进入该睡眠类型的时间戳(单位秒)
/// Timestamp(unix second) when entering this sleep mode
@property (nonatomic, assign) NSUInteger timestamp;

/// 进入该睡眠类型的时间字符串
/// Time string when entering this sleep mode
@property (nonatomic, strong) NSString *timestampStr;

///  -->
/// 将睡眠详情模型数组转换为JSON字符串
/// Convert an array of sleep detail models to a JSON string
+ (NSString *)toJSONString:(NSArray<BTSleepDetailModel *> *)models;

/// <--
/// 将JSON字符串转换为睡眠详情模型数组
/// Convert  a JSON string to an array of sleep detail models
+ (NSArray<BTSleepDetailModel *> *)fromJSONString:(NSString *)jsonString;

@end

NS_ASSUME_NONNULL_END
