//
//  BTHealthScore.h
//  RingSDK
//
//  Created by Kaoji on 2024/6/17.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#pragma mark - 睡眠评分 SleepScore
@interface BTSleepScore : NSObject<NSSecureCoding>

/// 日期，即0点0分0秒的时间戳 Long date
@property (nonatomic, assign) NSUInteger timestamp;
/// 睡眠综合得分，0~100 Int sleepScore
@property (nonatomic, assign) int sleepScore;
/// 睡眠时长得分，0~100 Int sleepDurationScore
@property (nonatomic, assign) int sleepDurationScore;
/// 深睡效率得分，0~100 Int sleepEfficiencyScore
@property (nonatomic, assign) int sleepEfficiencyScore;
/// 深睡得分，0~100 Int deepSleepScore
@property (nonatomic, assign) int deepSleepScore;
/// 眼动睡眠得分，0~100 Int remSleepScore
@property (nonatomic, assign) int remSleepScore;
/// 睡眠安宁得分，0~100 Int restfulnessScore
@property (nonatomic, assign) int restfulnessScore;
/// 睡眠呼吸质量得分，0~100 Int sleepBreathScore
@property (nonatomic, assign) int sleepBreathScore;

@end

#pragma mark - 活动评分 ActivityScore
@interface BTActivityScore : NSObject<NSSecureCoding>

/// 日期，即0点0分0秒的时间戳 Long date
@property (nonatomic, assign) NSUInteger timestamp;
/// 活动综合得分，0-100 Int activityScore
@property (nonatomic, assign) int activityScore;
/// 活动得分，0-100 Int stayActivityScore
@property (nonatomic, assign) int stayActivityScore;
/// 每日活动目标达成率得分，0-100 Int meatDailyGoalScore
@property (nonatomic, assign) int meatDailyGoalScore;
/// 运动频率得分，0-100 Int exerciseFrequencyScore
@property (nonatomic, assign) int exerciseFrequencyScore;
/// 运动量得分，0-100 Int exerciseVolumeScore
@property (nonatomic, assign) int exerciseVolumeScore;

@end

#pragma mark - 恢复评分 ReadinessScore
@interface BTReadinessScore : NSObject<NSSecureCoding>

/// 日期，即0点0分0秒的时间戳 Long date
@property (nonatomic, assign) NSUInteger timestamp;
/// 恢复综合得分，0-100 Int readinessScore
@property (nonatomic, assign) int readinessScore;
/// 前一晚睡眠得分，0-100 Int previousSleepScore
@property (nonatomic, assign) int previousSleepScore;
/// 前一天活动得分，0-100 Int previousActivityScore
@property (nonatomic, assign) int previousActivityScore;
/// 恢复指数得分，0-100 Int recoveryIndexScore
@property (nonatomic, assign) int recoveryIndexScore;
/// 睡眠体温变化得分，0-100 Int temperatureScore
@property (nonatomic, assign) int temperatureScore;
/// 静息心率得分，0-100 Int rhrScore
@property (nonatomic, assign) int rhrScore;

@end

#pragma mark - 健康综合评分 BTHealthScore
@interface BTHealthScore : NSObject<NSSecureCoding>

/// 日期，即0点0分0秒的时间戳 Long date
@property (nonatomic, assign) NSUInteger timestamp;
/// 睡眠评分 SleepScore sleepScore
@property (nonatomic, strong) BTSleepScore * _Nullable sleepScore;
/// 活动评分 ActivityScore activityScore
@property (nonatomic, strong) BTActivityScore * _Nullable activityScore;
/// 恢复评分 ReadinessScore readinessScore
@property (nonatomic, strong) BTReadinessScore * _Nullable readinessScore;

/// 调试打印 debug print
- (nullable NSString *)debugPrint;

// 将对象转换为NSData。Converts this object to NSData.
- (nullable NSData *)toData;

//  从NSData中创建对象。Creates an object from NSData.
+ (nullable instancetype)fromData:(NSData *)data;

// 将对象转换为JSON。Converts this object to JSON.
- (nullable NSString *)toJSON;

// 将对象转换为JSON。Converts this object to JSON.
+ (nullable instancetype)fromJSON:(NSString *)json;

@end

NS_ASSUME_NONNULL_END
