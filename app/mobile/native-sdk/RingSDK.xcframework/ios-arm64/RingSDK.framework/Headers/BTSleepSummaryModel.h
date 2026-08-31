//
//  BTSleepSummaryModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/29.
//

#import <Foundation/Foundation.h>

@class BTNapDetailModel;
NS_ASSUME_NONNULL_BEGIN

/// 睡眠总结模型类
/// Model class for sleep summary
@interface BTSleepSummaryModel : NSObject

/// 睡眠日期，以睡眠结束所在天的零时时间戳（秒级）为准 , 睡眠日期设为晚9点后的次日。
/// Sleep date, represented as the zero-hour timestamp (in seconds) of the day when sleep ended. Set day after 9 PM as sleep date.
@property (nonatomic, assign) NSUInteger timestamp;

/// 测量类型标识
/// Measurement type identifier
@property (nonatomic, assign) NSUInteger measurementType;

/// 深睡持续时间
/// Duration of deep sleep
@property (nonatomic, assign) NSUInteger deepSleepDuration;

/// 浅睡持续时间
/// Duration of light sleep
@property (nonatomic, assign) NSUInteger lightSleepDuration;

/// 清醒持续时间
/// Duration of awake time
@property (nonatomic, assign) NSUInteger awakeDuration;

/// 未佩戴持续时间
/// Duration of Not worn.
@property (nonatomic, assign) NSUInteger notWornDuration;

/// 清醒次数
/// Number of awakenings
@property (nonatomic, assign) NSUInteger awakeCount;

/// 快速眼动睡眠持续时间
/// Duration of REM sleep
@property (nonatomic, assign) NSUInteger remSleepDuration;

/// 总睡眠时间
/// Total sleep duration
@property (nonatomic, assign) NSUInteger totalSleepDuration;

/// 睡眠开始时间字符串
/// Start time of sleep (string format)
@property (nonatomic, copy) NSString *startTimeStr;

/// 睡眠结束时间字符串
/// End time of sleep (string format)
@property (nonatomic, copy) NSString *endTimeStr;

/// 睡眠开始时间戳
/// Start timestamp of sleep
@property (nonatomic, assign) NSUInteger startTimestamp;

/// 睡眠结束时间戳
/// End timestamp of sleep
@property (nonatomic, assign) NSUInteger endTimestamp;

/// 小睡详情数组
/// Array of nap details
@property (nonatomic, strong) NSMutableArray<BTNapDetailModel *> *napDetails;

/// 临时睡眠详情，非综合表接口，不参与JSON, 仅用于评分计算临时存储
/// Temp sleep details, not for comprehensive API, not for JSON
@property (nonatomic, strong) NSArray<BTSleepDetailModel *> *sleepDetails;

/// 创建一个默认的睡眠综合模型，所有属性设置为0，除了时间戳。
/// Create a default sleep summary model with all properties set to 0 except for the timestamp.
/// @param timestamp 时间戳，用于初始化模型的时间戳属性。
+ (instancetype)defaultSummaryWithTimestamp:(NSUInteger)timestamp;

/// --->
/// 将睡眠总结模型数组转换为JSON字符串
/// Convert an array of sleep summary models to a JSON string
+ (NSString *)toJSONString:(NSArray<BTSleepSummaryModel *> *)models;

/// <--
/// 将JSON字符串转换为睡眠总结模型数组
/// Convert a JSON string to an array of sleep summary models
+ (NSArray<BTSleepSummaryModel *> *)fromJSONString:(NSString *)jsonString;


@end

NS_ASSUME_NONNULL_END
