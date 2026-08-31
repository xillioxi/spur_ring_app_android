//
//  NSData+Conversion.h
//  AIZOSDK
//
//  Created by kaoji on 10/9/23.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NSData (Conversion2)

// 十六进制化显示
- (NSString *)toHexString;

// 空格十六进制
- (NSString *)toSpacedHex;

@end

NS_ASSUME_NONNULL_END
