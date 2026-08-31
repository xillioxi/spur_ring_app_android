#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AMCRC32 : NSObject
+ (uint32_t)crc32ForBytes:(const uint8_t *)bytes length:(NSUInteger)length;
+ (uint32_t)crc32ForData:(NSData *)data;
@end

NS_ASSUME_NONNULL_END

