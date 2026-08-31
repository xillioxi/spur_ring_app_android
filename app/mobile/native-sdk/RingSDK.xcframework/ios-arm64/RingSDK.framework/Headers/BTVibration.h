//
//  BTVibration.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/11/12.
//

#import <Foundation/Foundation.h>
#import <RingSDK/RingDef.h>
#import <RingSDK/BTVibrationSwitch.h>
#import <RingSDK/BTHealthWarningSetting.h>
#import <RingSDK/BTNotificationRecord.h>
#import <RingSDK/BTNotificationRecordManager.h>
#import <RingSDK/BTAlarm.h>
#import <RingSDK/BTAlarmManager.h>

NS_ASSUME_NONNULL_BEGIN

/// 震动功能管理器。Vibration feature manager.
@interface BTVibration : NSObject

/// 发送震动提醒。Send vibration notification.
/// @param type 提醒类型。Notification type.
/// @param completion 回调，包含ACK信息（成功或失败）。Callback with ACK status (success or failure).
/// @return 返回值表示请求是否成功发送。Return value indicates whether the request was successfully sent.
- (BOOL)sendVibrationWithType:(BTVibrationType)type completion:(void (^)(BOOL success))completion;

/// 发送提醒开关设置指令。Send vibration switch settings.
/// @param switches 提醒开关设置数组。Array of vibration switch settings.
/// @param completion 回调，包含ACK信息（成功或失败）。Callback with ACK status (success or failure).
/// @return 返回值表示请求是否成功发送。Return value indicates whether the request was successfully sent.
- (BOOL)sendVibrationSwitchSettings:(NSArray<BTVibrationSwitch *> *)switches
                         completion:(void (^)(BOOL success))completion;

/// 查询当前提醒开关设置。Query current vibration switch settings.
/// @param type 提醒类型，指定查询的类型，例如来电提醒、系统应用提示等。Notification type, specifies the type to query, e.g., incoming call, system event, etc.
/// @param isAll 是否查询所有提醒类型。YES 表示查询所有类型，忽略 type 参数；NO 表示查询指定的 type 类型。
///              Indicates whether to query all notification types. YES means query all types and ignore the `type` parameter; NO means query the specified `type`.
/// @param completion 回调，返回解析后的提醒开关数组。Callback with parsed vibration switch array.
/// @return 返回值表示请求是否成功发送。Return value indicates whether the request was successfully sent.
- (BOOL)queryVibrationSwitchSettings:(BTVibrationType)type
                               isAll:(BOOL)isAll
                          completion:(void (^)(NSArray<BTVibrationSwitch *> * _Nullable switches))completion;

/// 发送健康预警设置指令。Send health warning settings.
/// @param setting 健康预警设置。Health warning settings.
/// @param completion 回调，返回ACK成功或失败。Callback with ACK status (success or failure).
/// @return 返回值表示请求是否成功发送。Return value indicates whether the request was successfully sent.
- (BOOL)sendHealthWarningSetting:(BTHealthWarningSetting *)setting
                      completion:(void (^)(BOOL success))completion;

/// 查询当前健康预警设置。Query current health warning settings.
/// @param type 健康预警类型，0x00 查询所有类型。Health warning type, 0x00 to query all types.
/// @param isAll 是否查询所有类型。Whether to query all types.
/// @param completion 回调，返回解析后的健康预警设置数组。Callback with parsed health warning settings array.
/// @return 返回值表示请求是否成功发送。Return value indicates whether the request was successfully sent.
- (BOOL)queryHealthWarningSettings:(BTHealthWarningType)type
                            isAll:(BOOL)isAll
                        completion:(void (^)(NSArray<BTHealthWarningSetting *> * _Nullable settings))completion;

/// 获取提醒记录。Fetch notification records.
/// @param completion 回调，返回提醒记录数组或错误信息。Callback with notification records array or an error.
- (void)fetchNotificationRecords:(void (^)(NSArray<BTNotificationRecord *> * _Nullable records, NSError * _Nullable error))completion;

/// 获取闹钟数据。Fetch alarm data.
/// @param timestamp 时间戳。Timestamp.
/// @param completion 回调，返回闹钟数组或错误信息。Callback with alarm array or an error.
- (void)fetchAlarmsWithTimestamp:(NSData *)timestamp
                      completion:(void (^)(NSArray<BTAlarm *> * _Nullable alarms, NSError * _Nullable error))completion;

/// 设置闹钟。Set an alarm.
/// @param alarm 闹钟模型。Alarm model.
/// @param timestamp 时间戳。Timestamp.
/// @param completion 回调，返回设置是否成功。Callback with success status or an error.
- (void)setAlarm:(BTAlarm *)alarm
       timestamp:(NSData *)timestamp
      completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

@end

NS_ASSUME_NONNULL_END
