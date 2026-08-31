//
//  BTSportDetailModel.h
//  RingSDK
//
//  Created by kaoji on 6/15/24.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 运动详细数据模型，封装从设备接收的每一时段的运动数据。
/// Model for detailed sport data, encapsulating data received for each period during a sport activity.
@interface BTSportDetailModel : NSObject

/// 运动ID，用于标识特定的运动会话。
/// Sport ID, used to identify a specific sport session.
@property (nonatomic, strong) NSData *sportID;

/// 运动模式，根据预定义的类型确定当前的运动类型。
/// Sport type, determined according to predefined types.
@property (nonatomic, assign) UInt8 sportType;

/// 时段编号，即从运动开始时的秒数偏移，用于标识运动数据的时间点。
/// Time ID, the second offset from the start of the sport, used to identify the timing of the sport data.
@property (nonatomic, assign) UInt16 timeID;

/// 消耗的卡路里，单位为百卡，运动期间的能量消耗。
/// Calories burned, in units of 100 kcal, reflecting the energy expenditure during the sport.
@property (nonatomic, assign) UInt16 calories;

/// 步数，统计特定时段内的总步数。
/// Steps, counting the total number of steps during a specific period.
@property (nonatomic, assign) UInt32 steps;

/// 距离，单位为10米，表示运动期间移动的总距离。
/// Distance, in units of 10 meters, representing the total distance moved during the sport.
@property (nonatomic, assign) UInt16 distance;

/// 体温，以0.1摄氏度为单位，测量运动期间的体温。0值表示无数据。
/// Temperature, measured in units of 0.1 degrees Celsius, during the sport. A value of 0 indicates no data.
@property (nonatomic, assign) float temperature;

/// 心率，每分钟心跳次数，用于监测运动强度。
/// Heart rate, in beats per minute, used to monitor the intensity of exercise.
@property (nonatomic, assign) UInt8 heartRate;

/// 配速，单位为秒/千米。
/// Pace in seconds per kilometer.
@property (nonatomic, assign) NSUInteger pace;

/// 速度，单位为公里每小时，表示运动期间的移动速度。
/// Speed, in kilometers per hour, representing the speed during the sport.
@property (nonatomic, assign) float speed;

/// 踏频，单位为步每分钟，表示运动期间的步频。
/// Cadence, in steps per minute, representing the cadence during the sport.
@property (nonatomic, assign) float cadence;

/// 从NSData中解析并创建运动详细数据模型的数组。
/// Parses and creates an array of sport detail models from NSData.
/// @param data Binary data received from the device containing details for multiple periods of a sport session.
+ (NSArray<BTSportDetailModel *> *)modelsFromData:(NSData *)data;

/// BTSportDetailModel数组转JSONString Converts an array of BTSportDetailModel instances into a JSON string.
/// @param models BTSportDetailModel的数组  Array of BTSportDetailModel instances.
+ (NSString *)toJSONStringWithModels:(NSArray<BTSportDetailModel *> *)models;

/// Converts the model object to a JSON string.
/// 将模型对象转换为 JSON 字符串。
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
