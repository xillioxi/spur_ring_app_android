//
//  BTHealthWarningSetting.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/11/12.
//


#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 健康预警设置模型。Health warning setting model.
@interface BTHealthWarningSetting : NSObject

/// 预警类型。Warning type.
@property (nonatomic, assign) BTHealthWarningType type;

/// 过高开关状态。High threshold switch status.
@property (nonatomic, assign) BOOL highSwitchOn;

/// 过高预警阈值。High warning threshold.
@property (nonatomic, assign) UInt16 highThreshold;

/// 过低开关状态。Low threshold switch status.
@property (nonatomic, assign) BOOL lowSwitchOn;

/// 过低预警阈值。Low warning threshold.
@property (nonatomic, assign) UInt16 lowThreshold;

/// 初始化健康预警设置。Initialize health warning setting.
/// @param type 预警类型。Warning type.
/// @param highSwitchOn 过高开关状态。High switch status.
/// @param highThreshold 过高预警阈值。High warning threshold.
/// @param lowSwitchOn 过低开关状态。Low switch status.
/// @param lowThreshold 过低预警阈值。Low warning threshold.
- (instancetype)initWithType:(BTHealthWarningType)type
                highSwitchOn:(BOOL)highSwitchOn
               highThreshold:(UInt16)highThreshold
                 lowSwitchOn:(BOOL)lowSwitchOn
                lowThreshold:(UInt16)lowThreshold;

@end

NS_ASSUME_NONNULL_END
