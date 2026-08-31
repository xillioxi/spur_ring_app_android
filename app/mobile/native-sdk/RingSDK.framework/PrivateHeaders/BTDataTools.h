#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTDataTools : NSObject

/// 解析戒指返回蓝牙数据的header
+ (NSDictionary *)getBluetoothHeaderDictionaryWithSendData:(NSData *)sendData;

/// 解析戒指返回蓝牙数据的protocol
+ (NSDictionary *)getBluetoothProtocolDictionaryWithSendData:(NSData *)sendData;

/// 获取蓝牙数据包长度
+ (NSInteger)getBluetoothPackageLengthWithSendData:(NSData *)sendData;

/// 本地crc16校验
+ (NSData *)crc16WithData:(NSData *)data;

/// 检查是否是鉴权回复指令
+ (BOOL)isAuthorizationReply:(NSData *)data;

/// 计算OTA本地校验和
+ (NSData *)checkSumWithData:(NSData *)data;

/// long long 转为 NSData
+ (NSData *)longToNSData:(long long)sum;

/// 针对CRC校验失败的数据进行处理
+ (NSData *)getDataForCRC16FailedWithData:(NSData *)tempData snNumber:(NSInteger)sn;

/// 通过 NSDate 获取对应的 NSData
+ (NSData *)getCurrentTimeIntervalDataByDate:(NSDate *)date;

/// 通过 NSDate 获取午夜零点的时间戳NSData
+ (NSData *)getZeroTimeIntervalDataByDate:(NSDate *)date;

/// 根据给定长度和字符串获取对应的NSData，不足补0或过长切割处理
+ (NSData *)getBluetoothDataUTF8WithString:(NSString *)string dataLength:(NSInteger)length isBlank:(BOOL)isBlank;

/// 传入协议数据获取整包蓝牙数据
+ (NSData *)getBluetoothDataSendToWatchesWithTempData:(NSData *)data;

/// 获取历史睡眠数据的sleepID，21:00到第二天20:59:59视为当天的睡眠数据
+ (NSInteger)getSleepIdFromDate:(NSDate *)date;

/// int转为4字节的NSData
+ (NSData *)int4Data:(NSInteger)i;

/// int转为8字节的NSData
+ (NSData *)int8Data:(NSInteger)i;

/// 获取时间戳加密变换后的数据
+ (NSString *)getEncodeTimeIntervalDataWithDate:(NSDate *)date;

/// 蓝牙获取包长度字节数据
+ (NSData *)getBluetoothPackageLengthDataWithSendData:(NSData *)sendData;

/// 蓝牙获取字符串的header字节数据
+ (NSData *)getBluetoothHeaderBytesStringWithSender:(NSInteger)sender recipient:(NSInteger)recipient protocolVersion:(NSInteger)version protocolType:(NSInteger)type ACKTag:(NSInteger)ack packageType:(NSInteger)package RFU:(NSInteger)rfu SNNumber:(NSInteger)sn;

/// 从NSData转为int
+ (int)getIntValueFromData:(NSData *)data;

/// 对重复数据进行编码
+ (NSData *)encodeRepeatDataWithString:(NSString *)string;

/// 解码重复数据字符串
+ (NSString *)decodeRepeatStringWithData:(NSData *)data;

/// 针对字符串转data，需传输固定长度的data，不足补0，过长切割处理
+ (NSData *)getBluetoothDataWithString:(NSString *)string dataLength:(NSInteger)length;

/// 针对含中文字符串转data，unicode编码，需传输固定长度的data，不足补0，过长切割处理
+ (NSData *)getBluetoothDataSupplementWithString:(NSString *)string dataLength:(NSInteger)length isBlank:(BOOL)isBlank;

/// Data 转换为 date 字符串
+ (NSString *)convertDateFromData:(NSData *)data;

/// Data 转换为 unix时间戳 (秒)
+ (NSTimeInterval)convertToTimestampFromDateData:(NSData *)data;

/// int转为NSData
+ (NSData *)int2Data:(int)i;

/// 将time字符串转换为NSData
+ (NSData *)getTimeDataByTimeString:(NSString *)timeString;

+ (NSDateComponents *)dateComponentsFromData:(NSData *)data;

+ (BOOL)isTimestampWithinRange:(NSTimeInterval)timestamp;

@end

NS_ASSUME_NONNULL_END
