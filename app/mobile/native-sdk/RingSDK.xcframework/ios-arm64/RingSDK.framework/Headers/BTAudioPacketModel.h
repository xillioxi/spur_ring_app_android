//
//  BTAudioPacketModel.h
//  RingSDK
//
//  Created by 黄建华 on 2025/11/6.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
@interface BTAudioPacketModel : NSObject

@property (nonatomic, assign) UInt16 command;      // 命令：2字节，固定值0xAC22，表示设备向APP上报原始数据
@property (nonatomic, assign) UInt8 dataType;    // 0x01 音频文件
@property (nonatomic, assign) UInt8 headYear;    // 年（实际年份 = headYear + 2000）
@property (nonatomic, assign) UInt8 headMonth;   // 月（1~12）
@property (nonatomic, assign) UInt8 headDay;     // 日（1~31）
@property (nonatomic, assign) UInt8 headHour;    // 时（0~23）
@property (nonatomic, assign) UInt8 headMinute;  // 分（0~59）
@property (nonatomic, assign) UInt8 headSecond;  // 秒（0~59）
@property (nonatomic, strong) NSData *timeData;    // 6字节的时间头数据
@property (nonatomic, assign) UInt64 packedTime; // 6字节的时间头数据
@property (nonatomic, assign) UInt32  packetCount; // 总包数
@property (nonatomic, assign) UInt32  packetIndex;     // 当前分包序号：4字节，小端序，每秒数据编号从1开始
@property (nonatomic, assign) BOOL    isLastPacket;    // 是否最后一包：1字节，0表示否，1表示是
@property (nonatomic, assign) BOOL    isReSend;        // 是否重传
@property (nonatomic, assign) UInt16 dataLength;      // 数据长度：2字节，
@property (nonatomic, strong) NSData *data;            // 数据：n字节，表示实际传输的数据内容
@property (nonatomic, strong) NSData *reservedData;    // 数据：3节，预留字段（指端音频数据）
@property (nonatomic, assign) UInt32 currentFileIndex;  // 当前文件序号（从 1 开始）
@property (nonatomic, assign) UInt32 totalFileCount;    // 文件总数
@property (nonatomic, assign) BOOL isAC24;

@property (nonatomic, strong) NSData *utcData; // 4个字节的utc原始数据 大端序

//MARK: - 通过 utcData (4 字节大端序) 计算 utcTimestamp
@property (nonatomic, assign) UInt32 utcTimestamp; // 只显示不存

/// 根据二进制数据解析生成 BTAudioPacketModel 对象
/// - 参数 data: 原始二进制数据
/// - 返回: 解析后的 BTAudioPacketModel 对象
+ (instancetype)packetFromData:(NSData *)data;



@end

NS_ASSUME_NONNULL_END
