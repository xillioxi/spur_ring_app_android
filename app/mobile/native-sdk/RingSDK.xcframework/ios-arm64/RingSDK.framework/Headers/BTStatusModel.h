//
//  BTStatusModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/24.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 用于保存戒指设备的状态信息，包括电量水平和工作模式。
/// Used to store status information of a ring device, including battery level and work mode.
@interface BTStatusModel : NSObject

/// 戒指的当前电量水平。
/// Current battery level of the ring.
@property (nonatomic, assign) NSInteger electricityLevel;

/// 戒指的当前工作模式。
/// Current work mode of the ring.
@property (nonatomic, assign) NSInteger workMode;

/// 使用戒指传来的二进制数据初始化状态模型的新实例。
/// Initializes a new instance of the status model with binary data from the ring.
/// @param data Data from the ring that includes battery level and work mode.
- (instancetype)initWithData:(NSData *)data;

/// 将模型的属性转换为JSON格式的字符串。
/// Converts the model's properties to a JSON-formatted string.
/// @return A JSON string representing the model's data.
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
