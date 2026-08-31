//
//  BTOriginalDataPacket.h
//  RingSDK
//
//  Created by Kaoji on 2024/12/10.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTOriginalDataPacket : NSObject

@property (nonatomic, assign) UInt16 command;       // 命令：2字节，固定值0xCC22，表示设备向APP上报原始数据
@property (nonatomic, strong) NSData *startTime;    // 测量开始时间：6字节，表示年月日，时分秒固定为0
@property (nonatomic, assign) uint8_t dataType;     // 数据类型：1字节，表示数据类别（1.健康数据，2.睡眠数据等）
@property (nonatomic, assign) uint8_t ackFrequency; // 几包ACK一次：1字节，表示ACK频率
@property (nonatomic, assign) UInt16 startPacketIndex; // 从第几包开始传：2字节，小端序，默认从1开始编号
@property (nonatomic, assign) UInt16 packetIndex;   // 当前分包序号：2字节，小端序，每秒数据编号从1开始
@property (nonatomic, assign) BOOL isLastPacket;    // 是否最后一包：1字节，0表示否，1表示是
@property (nonatomic, assign) uint8_t dataLength;   // 数据长度：1字节，表示本数据包中的数据字节数（最大值144）
@property (nonatomic, strong) NSData *data;         // 数据：n字节，表示实际传输的数据内容

@end

NS_ASSUME_NONNULL_END
