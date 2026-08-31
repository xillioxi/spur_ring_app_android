//
//  BTTouchEventModel.h
//  RingSDK
//
//  Created by Yezhihua on 2025/6/19.
//


#import <Foundation/Foundation.h>


NS_ASSUME_NONNULL_BEGIN

/// Represents the touch event on the smart ring.
/// 表示用户的触控事件。
@interface BTTouchEventModel : NSObject <NSSecureCoding>


/// Touch operation: 0x0103 Long press，0x0104 Wipe up，0x0105 Wipe down.
/// 触控动作：0x0103 长按，0x0104 向上滑动，0x0105 向下滑动。
@property (assign, nonatomic) NSInteger touchEvent;

/// Timestamp of the touch event, second level
/// 触控操作时间时间戳，秒级时间戳
@property (assign, nonatomic) NSUInteger touchTime;

/// Converts the model object to a JSON string.
/// 将模型对象转换为 JSON 字符串。
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
