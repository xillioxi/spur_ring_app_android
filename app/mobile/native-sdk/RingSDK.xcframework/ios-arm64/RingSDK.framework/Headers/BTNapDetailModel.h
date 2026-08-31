//
//  BTNapDetailModel.h
//  RingSDK
//
//  Created by kaoji on 5/30/24.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 表示零星小睡（Nap）的详细信息的模型类。
/// Model class representing the details of a nap.
@interface BTNapDetailModel : NSObject

/// 零星小睡开始的时间（字符串格式）。
/// Start time of the nap (in string format).
@property (nonatomic, strong) NSString *startTimeStr;

/// 零星小睡结束的时间（字符串格式）。
/// End time of the nap (in string format).
@property (nonatomic, strong) NSString *endTimeStr;

/// 零星小睡开始的时间戳（单位为秒）。
/// Start timestamp of the nap (in seconds).
@property (nonatomic, assign) NSUInteger startTimestamp;

/// 零星小睡结束的时间戳（单位为秒）。
/// End timestamp of the nap (in seconds).
@property (nonatomic, assign) NSUInteger endTimestamp;

/// 零星小睡的持续时间，单位为分钟。
/// Duration of the nap, in minutes.
@property (nonatomic, assign) NSUInteger durationInMinutes;

// 将字典格式转换为零星小睡详情
/// Converts the nap details into a dictionary format.
- (instancetype)initWithDictionary:(NSDictionary *)dictionary;

/// 将零星小睡详情转换为字典格式。
/// Converts the nap details into a dictionary format.
- (NSDictionary *)toDictionary;

+ (NSString *)toJSONStringFromNapDetails:(NSArray<BTNapDetailModel *> *)napDetails;
@end

NS_ASSUME_NONNULL_END
