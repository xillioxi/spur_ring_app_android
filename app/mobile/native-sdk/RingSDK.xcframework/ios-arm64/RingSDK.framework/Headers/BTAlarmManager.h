//
//  BTAlarmManager.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/11/13.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTAlarm.h>

NS_ASSUME_NONNULL_BEGIN

/// 闹钟管理器。Alarm manager.
@interface BTAlarmManager : NSObject

/// 获取闹钟数据。Fetch alarm data.
/// @param timestamp 时间戳。Timestamp.
/// @param completion 回调，返回解析后的闹钟数组或错误信息。Completion block with parsed alarm array or error.
- (void)fetchAlarmsWithTimestamp:(NSData *)timestamp
                      completion:(void (^)(NSArray<BTAlarm *> * _Nullable alarms, NSError * _Nullable error))completion;

/// 设置闹钟。Set an alarm.
/// @param alarm 闹钟模型。Alarm model.
/// @param timestamp 时间戳。Timestamp.
/// @param completion 回调，返回设置是否成功。Completion block with success status or error.
- (void)setAlarm:(BTAlarm *)alarm
       timestamp:(NSData *)timestamp
      completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

@end

NS_ASSUME_NONNULL_END
