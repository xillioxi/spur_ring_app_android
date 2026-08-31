//
//  BTSportSummaryModel.h
//  RingSDK
//
//  Created by kaoji on 6/15/24.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTSportDetailModel.h>

NS_ASSUME_NONNULL_BEGIN

/// 运动摘要数据模型，用于封装从设备接收到的运动摘要数据。
/// Model for sport summary data, encapsulating sport summary data received from the device.
@interface BTSportSummaryModel : NSObject

/// 运动ID，标识具体的运动会话。
/// Sport ID identifying a specific sport session.
@property (nonatomic, strong) NSData *sportID;

/// 运动日期，标识具体的运动会话开始时间的零时时间戳。
/// Sport ID identifying a specific sport session.
@property (nonatomic, assign) NSUInteger date;

/// 运动日期，标识具体的运动会话开始时间的零时时间戳。
/// Sport ID identifying a specific sport session.
@property (nonatomic, assign) NSUInteger startTime;

/// 运动类型，如室内步行、室内单车等。
/// Sport type, such as indoor walk, indoor bike, etc.
@property (nonatomic, assign) UInt8 sportType;

/// 运动持续时间，单位为秒。
/// Duration of the sport, in seconds.
@property (nonatomic, assign) UInt16 duration;

/// 本次运动消耗的卡路里，单位为百卡。
/// Calories burned during the sport, in units of 100 kcal.
@property (nonatomic, assign) UInt16 calories;

/// 本次运动的步数。
/// Number of steps taken during the sport.
@property (nonatomic, assign) UInt32 steps;

/// 本次运动的距离，单位为10米。
/// Distance covered during the sport, in units of 10 meters.
@property (nonatomic, assign) UInt16 distance;

/// 本次运动期间的体温，单位为0.1摄氏度。
/// Body temperature during the sport, in units of 0.1 degrees Celsius.
@property (nonatomic, assign) float temperature;

/// 本次运动期间的平均心率，单位为每分钟跳动次数。
/// Average heart rate during the sport, in beats per minute.
@property (nonatomic, assign) UInt8 heartRate;

/// 平均心率，单位为每分钟跳动次数。
/// Average heart rate during the sport session.
@property (nonatomic, assign) UInt8 avgHr;

/// 最大心率，单位为每分钟跳动次数。
/// Maximum heart rate during the sport session.
@property (nonatomic, assign) UInt8 maxHr;

/// 最小心率，单位为每分钟跳动次数。
/// 最小心率，单位为每分钟跳动次数。
/// Minimum heart rate during the sport session.
@property (nonatomic, assign) UInt8 minHr;

/// 平均配速，单位为秒/千米。
/// Average pace in seconds per kilometer.
@property (nonatomic, assign) NSUInteger avgPace;

/// 最大配速，单位为秒/千米。
/// Maximum pace in seconds per kilometer.
@property (nonatomic, assign) NSUInteger maxPace;

/// 最小配速，单位为秒/千米。
/// Minimum pace in seconds per kilometer.
@property (nonatomic, assign) NSUInteger minPace;

/// 平均速度，单位为 km/h。
/// Average avgSpeed in kilometers per hour.
@property (nonatomic, assign) float avgSpeed;

/// 最大速度，单位为 km/h。
/// Maximum speed in kilometers per hour.
@property (nonatomic, assign) float maxSpeed;

/// 最小速度，单位为 km/h。
/// Minimum speed in kilometers per hour.
@property (nonatomic, assign) float minSpeed;

/// 平均踏频，单位为转/分钟。
/// Average cadence in revolutions per minute.
@property (nonatomic, assign) UInt8 avgCadence;

/// 最大踏频，单位为转/分钟。
/// Maximum cadence in revolutions per minute.
@property (nonatomic, assign) UInt8 maxCadence;

/// 最小踏频，单位为转/分钟。
/// Minimum cadence in revolutions per minute.
@property (nonatomic, assign) UInt8 minCadence;

/// 临时运动详情，非综合表接口，不参与JSON, 仅用于评分计算临时存储
/// Temp sport details, not for comprehensive API, not for JSON
@property (nonatomic, strong) NSArray<BTSportDetailModel *> *detailsModels;

/// 使用从设备接收到的二进制数据初始化运动摘要模型的新实例。
/// Initializes a new instance of the sport summary model with binary data received from the device.
/// @param data Binary data received from the device that includes sport summary details.
- (instancetype)initWithData:(NSData *)data;

/// Converts the model object to a JSON string.
/// 将模型对象转换为 JSON 字符串。
- (NSString *)toJSONString;

/// Converts a JSON string to the model object.
/// 从 JSON 字符串创建 BTSportSummaryModel 实例
+ (nullable instancetype)fromJSONString:(NSString *)jsonString;

@end

NS_ASSUME_NONNULL_END
