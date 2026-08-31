//
//  BTHealthWarningSetting+Storage.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/12/4.
//

#import <RingSDK/BTHealthWarningSetting.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTHealthWarningSetting (Storage)

/// 存储当前设置
/// @param setting 要存储的健康预警设置
+ (void)storeCurrentSetting:(BTHealthWarningSetting *)setting;

/// 获取当前设置
/// @param type 健康预警类型
/// @return 返回当前设置，如果没有则返回 nil
+ (nullable instancetype)currentSettingForType:(BTHealthWarningType)type;

/// 删除当前设置
/// @param type 健康预警类型
+ (void)deleteCurrentSettingForType:(BTHealthWarningType)type;

/// 获取指定子类型的阈值
/// @param subType 子类型（高或低）
/// @return 返回阈值
- (UInt16)valueForSubType:(BTHealthWarningSubType)subType;

/// 判断指定子类型是否启用
/// @param subType 子类型（高或低）
/// @return 返回是否启用
- (BOOL)isEnabledForSubType:(BTHealthWarningSubType)subType;

@end

NS_ASSUME_NONNULL_END
