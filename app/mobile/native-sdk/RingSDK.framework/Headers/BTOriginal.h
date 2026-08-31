//
//  BTOriginal.h
//  RingSDK
//
//  Created by Kaoji on 2024/11/29.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTOriginalDataPacket.h>

/// 原始数据类型。
/// Original data type.
typedef NS_ENUM(Byte, BTOriginalDataType) {
    BTOriginalDataTypeHealth = 1,        // 健康数据 / Health data
    BTOriginalDataTypeSleep = 2,         // 睡眠数据 / Sleep data
    BTOriginalDataTypeNap = 3,           // 零星小睡数据 / Nap data
    BTOriginalDataTypeBloodGlucose = 4,  // 血糖数据 / Blood glucose data
    BTOriginalDataTypeECG = 5,           // ECG数据 / ECG data
    BTOriginalDataTypePPI = 6,           // PPI数据 / PPI data
    BTOriginalDataTypeOther = 7,          // 其他数据 / Other data
    BTOriginalDataTypeUV = 8              // 紫外线  /UV data
};

typedef NS_ENUM(NSInteger, BTOriginalErrorCode) {
    BTOriginalErrorCodeInvalidTimeFormat = 1001,    // 时间格式无效
    BTOriginalErrorCodeRequestNotReady,            // 请求未准备好
    BTOriginalErrorCodePacketTooShort,             // 数据包长度过短
    BTOriginalErrorCodeChecksumFailed,             // 校验和失败
    BTOriginalErrorCodeUnknown                     // 未知错误
};

NS_ASSUME_NONNULL_BEGIN

/// 原始数据上传管理器。
/// Manager for handling original data upload.
@interface BTOriginal : NSObject

/// 日志回调，用于集中处理日志信息。
/// Log handler for centralized logging of messages.
@property (nonatomic, copy, nullable) void (^logHandler)(NSString *logMessage);

/// ACK频率（默认值为5，每5包发送一次ACK）。
/// Frequency for sending ACK packets (default is 5, ACK sent every 5 packets).
@property (nonatomic, assign) UInt8 ackFrequency;

/// 当前测量开始时间（6字节，年月日时分秒）。
/// Current measurement start time (6 bytes, year, month, day, hour, minute, second).
@property (nonatomic, strong) NSData *currentStartTime;

/// 请求上传原始数据。
/// Requests the device to upload original data.
/// @param time 开始测量时间（6字节，年月日时分秒）。The start measurement time (6 bytes: year, month, day, hour, minute, second).
/// @param dataType 数据类型。The type of data being requested.
///                - 1: 健康数据 / Health data
///                - 2: 睡眠数据 / Sleep data
///                - 3: 零星小睡数据 / Nap data
///                - 4: 血糖数据 / Blood glucose data
///                - 5: ECG 数据 / ECG data
///                - 6: PPI 数据 / PPI data
/// @param ackFreq 指定多少包检查一次ACK。Specifies how many packets to wait before checking ACK.
/// @param comp 回调请求是否成功。Callback indicating whether the request was successful.
- (BOOL)reqUploadDataWithTime:(NSData *)time
                     dataType:(UInt8)dataType
                      ackFreq:(UInt8)ackFreq
                         comp:(void (^)(BOOL success, NSError * _Nullable error))comp;

/// 处理接收到的原始数据包。
/// Handles the received data packet.
///
/// @param data 原始数据包。The raw data packet.
/// @param completion 回调，返回解析出的数据段、是否为最后一包、当前包号及可能的错误。Callback returning parsed data segments, whether it is the last packet, the current packet index, and any possible error.
- (void)handleReceivedDataPacket:(NSData *)data
                      completion:(void (^)(BTOriginalDataPacket *parsedPacket, NSError * _Nullable error))completion;

/// 回复ACK给设备。
/// Sends an ACK to the device.
/// @param startTime 开始测量时间（6字节）。The start measurement time (6 bytes).
/// @param dataType 数据类型。The type of data being acknowledged.
/// @param packetIndex 确认接收的分包号。如果是最后一包，packetIndex 自动加 1；否则根据实际接收情况处理。The confirmed packet index. If this is the last packet, packetIndex is incremented by 1; otherwise, it is handled based on the actual received situation.
/// @param missingPacketIndices 缺失包的索引数组（如果有缺包，则传入缺包索引）。An array of missing packet indices (if there are missing packets, pass their indices here).
/// @param isLastPacket 是否为最后一包。如果为YES，则packetIndex会自动加 1；否则按实际接收情况处理。Whether this is the last packet. If YES, packetIndex is automatically incremented by 1; otherwise, it is handled based on the actual received situation.
/// @param completion 回调确认结果，表示ACK发送是否成功。Callback indicating the confirmation result, which indicates whether the ACK was sent successfully.
- (BOOL)sendAckForDataPacketWithStartTime:(NSData *)startTime
                                 dataType:(UInt8)dataType
                              packetIndex:(UInt16)packetIndex
                              isLastPacket:(BOOL)isLastPacket
                          missingPacketIndices:(NSArray<NSNumber *> *)missingPacketIndices
                                completion:(void (^)(BOOL success))completion;

/// 处理设备上传结束的通知。
/// Processes the upload end notification from the device.
///
/// @param data 包含上传结束通知的原始数据。The raw data containing the upload end notification.
/// @param completion 回调返回解析后的信息，包括以下参数：
///                   Callback returning the parsed information, including:
///                   - startTime: 开始测量时间（6字节）。The start measurement time (6 bytes).
///                   - dataType: 数据类型（1字节）。The type of data (1 byte).
///                   - lastPacketIndex: 最后一包的序号（2字节，大端模式）。The index of the last packet (2 bytes, big-endian).
///                   - receivedChecksum: 接收到的校验和（2字节，大端模式）。The received checksum (2 bytes, big-endian).
///                   - error: 如果处理过程中发生错误，则返回相关的错误信息；否则为 nil。
///                            If an error occurred during processing, returns the corresponding error; otherwise nil.
- (void)handleUploadEndNotificationWithData:(NSData *)data
                                 completion:(void (^)(NSData *startTime, UInt8 dataType, UInt16 lastPacketIndex, UInt16 receivedChecksum, NSError * _Nullable error))completion;

/// 回复原始数据上传结束ACK。
/// Sends an ACK for the end of original data upload.
/// @param startTime 开始测量时间（6字节）。The start measurement time (6 bytes).
/// @param lastPacketIndex 最后一包序号。The index of the last packet.
/// @param success 数据接收结果。Indicates whether the data reception was successful.
/// @param completion 回调确认结果。Callback indicating the confirmation result.
- (BOOL)sendUploadEndAckWithStartTime:(NSData *)startTime
                      lastPacketIndex:(UInt16)lastPacketIndex
                              success:(BOOL)success
                           completion:(void (^)(BOOL success))completion;

/// 记录日志的实用方法。
/// Utility method to log messages with a prefix and associated data.
/// @param prefix 日志前缀（如：[SND], [RCV]）。The log prefix (e.g., [SND], [RCV]).
/// @param data 关联的数据。The associated data.
/// @param message 日志内容。The log message.
- (void)logMessageWithPrefix:(NSString *)prefix data:(NSData *)data message:(NSString *)message;

@end

NS_ASSUME_NONNULL_END
