//
//  BTSportRealTimeModel.h
//  RingSDK
//
//  Created by kaoji on 6/14/24.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 运动实时数据模型类。Manages real-time data for ongoing sports activities.
@interface BTSportRealTimeModel : NSObject

/// 运动ID，表示当前运动会话。
/// Sport session identifier.
@property (nonatomic, strong) NSData *sportID;

/// 运动模式，如跑步、游泳等。
/// Current sport mode, such as running, swimming, etc.
@property (nonatomic, assign) NSUInteger sportMode;

/// 运动状态类型 (Sport Status Type)
/// - Active: 数据有效，继续解析 (Data valid, proceed parsing)
/// - Paused/Stopped: 数据无效，停止解析 (Data invalid, stop parsing)
/// - 其他: 数据无效 (Data invalid)
@property (nonatomic, assign) BTSportStatusType status;

/// 时间ID，从运动开始的秒数偏移。
/// Time ID, the second offset from the start of the sport.
@property (nonatomic, assign) NSUInteger timeID;

/// 当前卡路里消耗，单位为100卡。
/// Current calories burned in units of 100 kcal.
@property (nonatomic, assign) NSUInteger calories;

/// 步数。
/// Step count.
@property (nonatomic, assign) NSUInteger steps;

/// 距离，单位为10米。
/// Distance in units of 10 meters.
@property (nonatomic, assign) NSUInteger distance;

/// 体温，单位为0.1摄氏度。
/// Body temperature in units of 0.1 degrees Celsius.
@property (nonatomic, assign) float temperature;

/// 心率，每分钟跳动次数。
/// Heart rate in beats per minute.
@property (nonatomic, assign) NSUInteger heartRate;

/// 配速，单位为秒/千米。
/// Pace in seconds per kilometer.
@property (nonatomic, assign) NSUInteger pace;

/// 速度，单位为公里每小时，表示运动期间的移动速度。
/// Speed, in kilometers per hour, representing the speed during the sport.
@property (nonatomic, assign) float speed;

/// 踏频，单位为步每分钟，表示运动期间的步频。
/// Cadence, in steps per minute, representing the cadence during the sport.
@property (nonatomic, assign) float cadence;

/// 初始化方法，用于从NSData中解析运动实时数据。
/// Initializes the model by parsing real-time sport data from NSData.
/// @param data Data containing the real-time sport statistics.
- (instancetype)initWithData:(NSData *)data;

/// 将模型属性转换为JSON字符串
/// Convert model properties to a JSON string
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
