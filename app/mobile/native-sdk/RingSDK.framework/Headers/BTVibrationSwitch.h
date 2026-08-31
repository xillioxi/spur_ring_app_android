//
//  BTVibrationSwitch.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/11/12.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 震动开关模型。Vibration switch model.
@interface BTVibrationSwitch : NSObject

/// 提醒类型。Notification type.
@property (nonatomic, assign) BTVibrationType type;

/// 开关状态。Switch status.
@property (nonatomic, assign) BOOL isOn;

/// 初始化提醒开关模型。Initialize vibration switch model.
/// @param type 提醒类型。Notification type.
/// @param isOn 开关状态。Switch status.
- (instancetype)initWithType:(BTVibrationType)type isOn:(BOOL)isOn;

@end

NS_ASSUME_NONNULL_END
