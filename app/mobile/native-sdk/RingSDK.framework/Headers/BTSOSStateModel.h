//
//  BTSOSStateModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/30.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 模型类，用于表示设备的SOS功能状态
/// Model class representing the state of the SOS feature on the device
@interface BTSOSStateModel : NSObject

/// 是否启用SOS功能
/// Whether the SOS feature is enabled
@property (nonatomic, assign) BOOL isSOSEnabled;

/// 发送电源键HID次数
/// Number of times the power button HID has been sent
@property (nonatomic, assign) NSInteger hidCount;

/// 将对象转换为JSON字符串
/// Convert the object to JSON string
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
