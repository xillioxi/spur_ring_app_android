//
//  BTVibrationConfig.h
//  RingSDK
//
//  Created by yezhihua on 2025/6/20.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTVibrationConfigModel.h>


NS_ASSUME_NONNULL_BEGIN

/// 震动功能管理器。Vibration feature manager.
@interface BTVibrationConfig : NSObject


/// 发送震动模式设置指令。Send vibration mode configurations.
/// @param setting 震动模式设置。Vibration mode configurations.
/// @param completion 回调，返回ACK成功或失败。Callback with ACK status (success or failure).
/// @return 返回值表示请求是否成功发送。Return value indicates whether the request was successfully sent.
- (BOOL)setVibrationModeConfiguration:(BTVibrationConfigModel *)setting
                           completion:(void (^)(BOOL success))completion;

/// 查询当前震动模式设置。Query current vibration mode configuration.
/// @param index 震动模式编号，0x01-0x05 震动模式编号，0x00 查询所有模式。Vibration mode index, 0x00 to query all modes.
/// @param completion 回调，返回解析后的震动模式设置数组。Callback with parsed vibration mode configuration array.
/// @return 返回值表示请求是否成功发送。Return value indicates whether the request was successfully sent.
- (BOOL)getVibrationModeConfiguration:(NSInteger)index
                           completion:(void (^)(NSMutableArray<BTVibrationConfigModel *> * _Nullable settings))completion;

@end

NS_ASSUME_NONNULL_END
