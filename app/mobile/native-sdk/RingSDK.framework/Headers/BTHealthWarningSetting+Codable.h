//
//  BTHealthWarningSetting+Codable.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/12/4.
//

#import <RingSDK/BTHealthWarningSetting.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTHealthWarningSetting (Codable) <NSSecureCoding>

/// 将对象编码为字典
- (NSDictionary *)toDictionary;

/// 从字典解码为对象
+ (instancetype)fromDictionary:(NSDictionary *)dictionary;

@end


NS_ASSUME_NONNULL_END
