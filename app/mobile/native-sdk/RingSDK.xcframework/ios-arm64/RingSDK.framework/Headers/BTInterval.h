//
//  BTInterval.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/12/17.
//

#import <Foundation/Foundation.h>

/// 健康数据自动监测间隔类型枚举
typedef NS_ENUM(UInt8, BTIntervalType) {
//    BTIntervalTypeHeartRate = 0x01,  // 心率
//    BTIntervalTypeBloodOxygen = 0x02,  // 血氧
//    BTIntervalTypeTemperature = 0x03,  // 体温
//    BTIntervalTypePressure = 0x04,  // 压力
//    BTIntervalTypeHRV = 0x05,  // 心率变异性
//    BTIntervalTypeECG = 0x06,  // 心电图
//    BTIntervalTypeBodyFat = 0x07,  // 体脂率
//    BTIntervalTypeBloodSugar = 0x08,  // 血糖
//    BTIntervalTypeBloodPressure = 0x09,  // 血压
//    BTIntervalTypeBreathingRate = 0x0A,  // 呼吸率
//    BTIntervalTypeStepCount = 0x0B,  // 步数
    BTIntervalTypePPI = 0x0C,  // PPI
//    BTIntervalTypeAll = 0x00,  // 所有健康数据
};

NS_ASSUME_NONNULL_BEGIN

/// 设备自动监测间隔管理类，用于获取和设置健康数据的自动监测间隔
@interface BTInterval : NSObject

/// 获取设备当前健康数据自动监测间隔
/// @param dataType 测量数据类型（使用 BTIntervalType 枚举）
/// @param completion 完成回调，返回自动监测间隔和默认自动监测间隔，单位：秒
/// - interval: 当前自动监测间隔，单位：秒
/// - defaultInterval: 设备出厂默认的自动监测间隔，单位：秒
/// @return 如果命令成功发送并注册，则返回 YES，否则返回 NO
- (BOOL)fetchAutoMonitorIntervalForDataType:(BTIntervalType)dataType completion:(void (^)(UInt16 interval, UInt16 defaultInterval))completion;

/// 设置设备健康数据自动监测间隔
/// @param interval 自动监测间隔，单位：秒
/// @param dataType 测量数据类型（使用 BTIntervalType 枚举）
/// @param completion 完成回调，返回是否设置成功
- (BOOL)setAutoMonitorInterval:(UInt16)interval forDataType:(BTIntervalType)dataType completion:(void (^)(BOOL success))completion;

@end

NS_ASSUME_NONNULL_END
