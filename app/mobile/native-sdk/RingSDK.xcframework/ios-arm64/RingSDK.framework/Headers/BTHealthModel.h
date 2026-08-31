//
//  BTHealthModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/29.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// BTHealthModel 类用于封装接收到的健康数据。
/// This class encapsulates the health data received from a device.
@interface BTHealthModel : NSObject

/// 所属日期的零时时间戳，表示数据接收当日的起始时间（00:00:00）的时间戳。
/// Timestamp representing the start of the date (00:00:00) when the data was received from the device.
@property (nonatomic, assign) NSUInteger date;

/// 时间戳，从设备接收的时间。
/// Timestamp representing the time data was received from the device.
@property (nonatomic, assign) NSUInteger timestamp;

/// 时间，从设备接收的时间。
/// time representing the time data was received from the device.
@property (nonatomic, copy) NSString *timeStr;

/// 日常心率，测量值范围0到250，人体可承受的最大心率不超过220。
/// Daily heart rate, values range from 0 to 250. The maximum tolerable heart rate for humans is 220.
@property (nonatomic, assign) NSUInteger dailyHeartRate;

/// 心率变异性(HRV)，以毫秒为单位，表示连续心跳之间的时间间隔变化，范围0到200。
/// Heart rate variability (HRV) in milliseconds, indicating variations between consecutive heartbeats, ranging from 0 to 200 ms.
@property (nonatomic, assign) NSUInteger hrv;

/// 血氧饱和度，取值范围为0到100，表示血液中的氧气含量百分比。
/// Blood oxygen saturation, values range from 0 to 100, representing the percentage of oxygen in the blood.
@property (nonatomic, assign) NSUInteger spo2;

/// 压力，取值范围为1到100，表示压力值。
/// Stress, values range from 1 to 100.
@property (nonatomic, assign) NSUInteger stress;

/// 行走距离，单位为米。
/// Distance walked, measured in meters.
@property (nonatomic, assign) NSUInteger distance;

/// 燃烧的卡路里数，单位为百卡。
/// Calories burned, measured in calories.
@property (nonatomic, assign) NSUInteger calories;

/// 步数，表示行走的总步数。
/// Number of steps taken.
@property (nonatomic, assign) NSUInteger steps;

/// 环境温度，单位为摄氏度。
/// Ambient temperature, measured in Celsius.
@property (nonatomic, assign) float environmentTemperature;

/// 人体温度，单位为摄氏度。
/// Body temperature, measured in Celsius.
@property (nonatomic, assign) float bodyTemperature;

/// SOS报警标志，表示是否触发了紧急求救信号。
/// SOS alert flag indicating whether an emergency signal has been triggered.
@property (nonatomic, assign) BOOL sosAlert;

/// 根据接收到的二进制数据创建BTHealthModel实例。
/// Creates an instance of BTHealthModel from the received binary data.
/// @param data 从设备接收的二进制数据。 Binary data received from the device.
+ (NSArray<BTHealthModel *> *)dataFromReceivedBytes:(NSData *)data;

/// BTHealthModel数组转JSONString Converts an array of BTHealthModel instances into a JSON string.
/// @param models BTHealthModel的数组  Array of BTHealthModel instances.
+ (NSString *)toJSONStringWithModels:(NSArray<BTHealthModel *> *)models;

/// <--
/// 将JSON字符串转换为睡眠详情模型数组
/// Convert  a JSON string to an array of sleep detail models
+ (NSArray<BTHealthModel *> *)fromJSONString:(NSString *)jsonString;

@end

NS_ASSUME_NONNULL_END
