//
//  BTVibrationConfigModel.h
//  RingSDK
//
//  Created by yezhihua on 2025/6/20.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 震动设置模型。Vibration configuration model.
@interface BTVibrationConfigModel : NSObject

/// 震动模式编号。Vibration model index.
@property (nonatomic, assign) UInt8 index;

/// 震动次数。Vibration times.
@property (nonatomic, assign) UInt8 times;

/// 每次震动时长，单位：100毫秒。 Duration per vibration.
@property (nonatomic, assign) UInt8 duration;

/// 间隔时长，单位：100毫秒。 Interval.
@property (nonatomic, assign) UInt8 interval;

/// 震动频率。Vibration frequency.
@property (nonatomic, assign) UInt16 frequency;

/// 震动强度。Vibration volume.
@property (nonatomic, assign) UInt8 volume;


/// 初始化震动设置模型。Initialize vibration configuration model.
/// @param data 震动设置模型数据。vibration configuration data.
- (instancetype)initWithData:(NSData *)data;

@end

NS_ASSUME_NONNULL_END

