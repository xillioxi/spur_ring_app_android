//
//  NSData+format.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/11.
//

//#import <Foundation/Foundation.h>
//
//NS_ASSUME_NONNULL_BEGIN
//
//@interface NSData (format)
//
///// 二进制 格式化 MAC 地址
///// D0:9F:D9:D2:52:BB
//- (NSString *)formattedMacAddr;
//
///// 将 NSData 转换为以空格间隔的十六进制字符串
/////  70 70 23 64 30 3A 39 66 3A 64 39 3A 64...
//- (NSString *)toHexWithSpaces;
//
///// SpacedHex 转回 二进制
//+ (nullable NSData *)fromHexWithSpaces:(NSString *)hexString;
//
//// -----------4字节时间处理----------
///// 传入4字节NSData 返回时间戳 unix
//+ (NSUInteger)timestampFromDateData:(NSData *)data zeroTime:(BOOL)isZeroTime;
//
///// 传入4字节NSData 返回时间字符串yyyy-MM-dd HH:mm:ss
//+ (NSString *)formattedDateStringFromDateData:(NSData *)data zeroTime:(BOOL)isZeroTime;
//
///// 传入4字节NSData 返回时间NSDateComponents
//+ (NSDateComponents *)dateComponentsFromData:(NSData *)data zeroTime:(BOOL)isZeroTime;
//
//// 6字节的时间处理
//+ (NSString *)dateStringFromSixByteData:(NSData *)data;
//+ (uint64_t)timestampFromSixByteData:(NSData *)data;
//
//@end
//
//NS_ASSUME_NONNULL_END


#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// NSData 类别，用于格式化和转换数据。
/// NSData category for formatting and conversions.
@interface NSData (format)

/// 二进制转MAC地址字符串
/// Formats binary data into a MAC address string.
- (NSString *)formattedMacAddr;

/// NSData转换为带空格的十六进制字符串
/// Converts NSData to a hex string with spaces.
- (NSString *)toHexWithSpaces;

/// 带空格的十六进制字符串转回NSData
/// Converts a spaced hex string back to NSData.
+ (nullable NSData *)fromHexWithSpaces:(NSString *)hexString;

// 4-byte time handling
/// 4字节NSData返回Unix时间戳
/// Returns a Unix timestamp from 4-byte NSData.
+ (NSUInteger)timestampFromDateData:(NSData *)data zeroTime:(BOOL)isZeroTime;

/// 4字节NSData返回格式化日期字符串
/// Returns a formatted date string from 4-byte NSData.
+ (NSString *)formattedDateStringFromDateData:(NSData *)data zeroTime:(BOOL)isZeroTime;

/// 4字节NSData返回NSDateComponents
/// Returns NSDateComponents from 4-byte NSData.
+ (NSDateComponents *)dateComponentsFromData:(NSData *)data zeroTime:(BOOL)isZeroTime;

// 6-byte time handling
/// 6字节NSData返回日期字符串
/// Returns a date string from 6-byte NSData.
+ (NSString *)dateStringFromSixByteData:(NSData *)data;

/// 6字节NSData返回Unix时间戳
/// Returns a Unix timestamp from 6-byte NSData.
+ (uint64_t)timestampFromSixByteData:(NSData *)data;

@end

NS_ASSUME_NONNULL_END
