//
//  BTPowerModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/23.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Represents the power status of a device.
/// 表示设备的电源状态。
@interface BTPowerModel : NSObject <NSSecureCoding>

/// Charging state: 0 for not charging, 1 for charging, 2 for fully charged.
/// 充电状态：0 未充电，1 正在充电，2 已充满。
@property (assign, nonatomic) NSInteger chargingState;

/// Battery level of the device.
/// 设备的电量等级 取值范围 0-100
@property (assign, nonatomic) NSInteger batteryLevel;

/// Converts the model object to a JSON string.
/// 将模型对象转换为 JSON 字符串。
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
