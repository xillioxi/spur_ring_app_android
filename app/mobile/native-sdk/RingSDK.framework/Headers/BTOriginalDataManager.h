//
//  BTOriginalDataManager.h
//  RingSDK
//
//  Created by Kaoji on 2024/12/06.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTOriginal.h>

NS_ASSUME_NONNULL_BEGIN

/// 错误类型。
/// Error types.
typedef NS_ENUM(NSUInteger, BTOriginalDataManagerError) {
    BTOriginalDataManagerErrorTimeout = 1,       // 超时错误 / Timeout error
    BTOriginalDataManagerErrorChecksumFailed,    // 校验和失败 / Checksum validation failed
    BTOriginalDataManagerErrorInvalidState,      // 非法状态 / Invalid state
    BTOriginalDataManagerErrorLengthMismatch,    // 长度不匹配 / Length mismatch
    BTOriginalDataManagerErrorPacketLoss,        // 分包丢失 / Packet loss
    BTOriginalDataManagerErrorAckFailed,         // ACK发送失败 / ACK transmission failed
    BTOriginalDataManagerErrorInvalidPacket      // 无效数据包 / Invalid packet
};

/// 数据接收完成回调。
/// Completion callback for data reception.
typedef void (^BTDataManagerCompletionHandler)(NSArray <BTOriginalDataPacket *> * _Nullable completeDatas, NSError * _Nullable error);

/// 原始数据管理器。
/// Manager for handling original data upload and reception.
@interface BTOriginalDataManager : NSObject

/// 日志回调，用于集中处理日志信息。
/// Log handler for centralized logging of messages.
/// 日志格式示例：
/// Example log format:
/// - `[MANAGER] Received packet 1. Total received length: 144/1024. ACK Frequency: 5.`
/// - `[MANAGER] ACK sent successfully for packet index: 5.`
/// - `[MANAGER] Data reception failed. Error: Packet loss detected.`
@property (nonatomic, copy, nullable) void (^logHandler)(NSString *logMessage);


/// 启动数据接收。
/// Starts receiving data.
/// @param startTime 开始测量时间（6字节，年月日时分秒）。The start measurement time (6 bytes: year, month, day, hour, minute, second).
/// @param dataType 数据类型。The type of data being received.
/// @param ackFrequency 指定多少包检查一次ACK（默认5）。Specifies how many packets to wait before sending an ACK (default is 5).
/// @param timeout 超时时间（秒，默认5秒）。Timeout duration in seconds (default is 5 seconds).
/// @param completion 数据接收完成回调。Completion callback for data reception. 返回接收的完整数据或错误信息。
- (void)startReceivingWithStartTime:(NSData *)startTime
                           dataType:(BTOriginalDataType)dataType
                       ackFrequency:(UInt8)ackFrequency
                            timeout:(NSTimeInterval)timeout
                         completion:(BTDataManagerCompletionHandler)completion;

/// 检查是否可以启动数据接收。
/// Checks if data reception can be started.
/// @return 返回YES表示可以启动，返回NO表示已有相关命令正在注册中或状态不允许。
/// Returns YES if data reception can be started, NO otherwise (e.g., relevant commands are already registered or the state does not allow starting).
- (BOOL)canStartReceiving;

@end

NS_ASSUME_NONNULL_END
