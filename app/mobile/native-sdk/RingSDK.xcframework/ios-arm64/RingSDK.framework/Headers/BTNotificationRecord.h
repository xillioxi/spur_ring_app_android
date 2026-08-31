//
//  BTNotificationRecord.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/11/13.
//


#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 提醒记录模型。Notification record model.
@interface BTNotificationRecord : NSObject

/// 分包编号。Packet index.
@property (nonatomic, assign) Byte packetIndex;

/// 提醒时间 - 年。Notification time - Year.
@property (nonatomic, assign) UInt8 year;

/// 提醒时间 - 月。Notification time - Month.
@property (nonatomic, assign) UInt8 month;

/// 提醒时间 - 日。Notification time - Day.
@property (nonatomic, assign) UInt8 day;

/// 提醒时间 - 时。Notification time - Hour.
@property (nonatomic, assign) UInt8 hour;

/// 提醒时间 - 分。Notification time - Minute.
@property (nonatomic, assign) UInt8 minute;

/// 提醒时间 - 秒。Notification time - Second.
@property (nonatomic, assign) UInt8 second;

/// 提醒类型。Notification type.
@property (nonatomic, assign) BTVibrationType type;

/// 提醒子类型。Notification subtype.
@property (nonatomic, assign) BTHealthWarningType subType;

/// 提醒值。Notification value.
@property (nonatomic, assign) UInt16 value;

/// 预警阈值。Warning threshold.
@property (nonatomic, assign) UInt16 threshold;

/// 过高还是过低（1-过高，2-过低）。Level (1 - High, 2 - Low).
@property (nonatomic, assign) Byte level;

/// 初始化提醒记录模型。Initialize notification record model.
/// @param data 提醒记录数据（单条）。Notification record data (single entry).
- (instancetype)initWithData:(NSData *)data;

@end

NS_ASSUME_NONNULL_END
