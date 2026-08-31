//
//  SNBleTimeUtils.h
//  AIZOSDK
//
//  Created by 黄建华 on 2025/1/6.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SNBleTimeUtils : NSObject

/// 获取当前时间的字符串格式
/// @param format 时间格式，例如 "yyyy-MM-dd HH:mm:ss"
+ (NSString *)currentTimeWithFormat:(NSString *)format;

/// 将日期对象转换为字符串
/// @param date 日期对象
/// @param format 时间格式，例如 "yyyy-MM-dd"
+ (NSString *)stringFromDate:(NSDate *)date withFormat:(NSString *)format;

/// 将字符串转换为日期对象
/// @param dateString 日期字符串
/// @param format 时间格式，例如 "yyyy-MM-dd"
+ (NSDate *)dateFromString:(NSString *)dateString withFormat:(NSString *)format;

/// 获取指定时间的时间戳（秒）
/// @param date 日期对象
+ (NSTimeInterval)timestampFromDate:(NSDate *)date;

/// 获取当前时间的时间戳（秒）
+ (NSTimeInterval)currentTimestamp;

/// 获取指定时间戳对应的日期对象
/// @param timestamp 时间戳（秒）
+ (NSDate *)dateFromTimestamp:(NSTimeInterval)timestamp;

/// 获取当前年份
+ (NSInteger)currentYear;

/// 获取当前月份
+ (NSInteger)currentMonth;

/// 获取当前天数
+ (NSInteger)currentDay;

/// 根据偏移量获取日期（0=今天，-1=昨天，1=明天，以此类推）
/// @param offset 偏移天数
+ (NSDate *)dateWithOffsetFromToday:(NSInteger)offset;

/// 获取指定 NSDate 的 0 点时间戳（秒）
/// @param date 输入的日期对象
+ (NSTimeInterval)zeroTimestampFromDate:(NSDate *)date;

// MARK: - 蓝牙需要的时间6字节时间挫
+ (NSData *)getZeroTimeIntervalDataByDate:(NSDate *)date;

@end

NS_ASSUME_NONNULL_END
