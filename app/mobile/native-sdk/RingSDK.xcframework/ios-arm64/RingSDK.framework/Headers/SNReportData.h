//
//  SNReportData.h
//  AIZOSDK
//
//  Created by 黄建华 on 2025/1/7.
//

#import <Foundation/Foundation.h>

@interface SNReportData : NSObject

@property(nonatomic,strong) NSString *commandString;

/// 命令 (2字节, U16)
/// 表示设备向APP上报原始数据的命令代码，例如 0xC822
@property (nonatomic, assign) uint16_t command;

/// 测量开始时间 (6字节, U8[6])
/// 包含年(减去2000)、月、日，时分秒全为0。例如: 0x15 0x07 0x07 0x00 0x00 0x00
@property (nonatomic, strong) NSDate *startTime;

/// 数据类型 (1字节, U8)
/// 表示数据类型，例如：
/// 1: 健康数据
/// 2: 睡眠数据
/// 3: 零星小睡数据
/// 4: 血糖数据
/// 5: ECG数据
/// 6: PPI数据
@property (nonatomic, assign) uint8_t dataType;

/// 几包ack一次 (1字节, U8)
/// 表示设备发送数据包时，每隔几包发送一个ACK确认。例如: 5
@property (nonatomic, assign) uint8_t ackCount;

/// 从第几包开始传 (2字节, U16)
/// 默认从1开始，表示传输的起始数据包编号。
@property (nonatomic, assign) uint16_t startPackage;

/// 当前分包序号 (2字节, U16)
/// 表示当前传输的分包编号，从1开始编号。
@property (nonatomic, assign) uint16_t currentPackageNumber;

/// 是否最后一包 (1字节, U8)
/// 表示当前数据包是否为最后一包：
/// 0: 否
/// 1: 是
@property (nonatomic, assign) BOOL isLastPackage;

/// 数据长度 (1字节, U8)
/// 表示当前数据包中数据部分的字节数，最大值为144。
@property (nonatomic, assign) uint8_t dataLength;

/// 数据 (可变长度)
/// 包含协议中数据部分的内容，长度为 `dataLength` 字节。
@property (nonatomic, strong) NSData *data;

/// 初始化方法，根据NSData解析协议字段
/// @param data 待解析的NSData
/// @param error 若解析失败，返回错误信息
- (instancetype)initWithData:(NSData *)data error:(NSError **)error;

@end
