//
//  BTTouchModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/27.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 设备状态模型，封装设备的触控模式和状态
/// Device state model, encapsulating the touch mode and state of the device
@interface BTTouchModel : NSObject

/// 当前触控模式
/// Current touch mode
@property (nonatomic, assign) BTTouchMode currentMode;

/// 触控模式是否启用
/// Whether the touch mode is enabled
@property (nonatomic, assign) BOOL isModeEnabled;

/// 触控是否开启
/// Whether touch is enabled
@property (nonatomic, assign) BOOL isTouchEnabled;

/// 将模型属性转换为JSON字符串
/// Convert model properties to a JSON string
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
