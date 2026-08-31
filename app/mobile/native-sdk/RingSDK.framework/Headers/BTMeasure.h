//
//  BTMeasure.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/27.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTMeasureResult.h>
#import <RingSDK/BTECGPacket.h>
#import <RingSDK/BTGluPacket.h>
#import <RingSDK/BTGluValue.h>
NS_ASSUME_NONNULL_BEGIN

// 测量完成回调
// Measurement completion handler
typedef void (^BTMeasureCompletionHandler)(BTMeasureResult *result);

/// 测量控制类，用于启动和停止测量
/// Measurement control class for starting and stopping measurements
@interface BTMeasure : NSObject

/// 开始测量指定类型的数据
/// Start measuring specified type of data
/// @param type 测量类型。Type of measurement.
/// @param ackCompletion 确认回调，表示戒指是否确认开始测量。Callback indicating whether the ring acknowledged the start of the measurement.
/// @param resultCompletion 结果回调，当结果接收时调用。Callback triggered when the measurement result is received.
/// @discussion 返回值为 YES 表示成功发送指令，NO 表示重复发送或发送失败。The return value YES indicates the command was sent successfully, while NO indicates a duplicate request or failure.
- (BOOL)startMeasurementWithType:(BTMeasureType)type
                        acked:(void (^)(BOOL acked))ackCompletion
                  resultReceived:(void (^)(BTMeasureResult * result))resultCompletion;


/// 停止指定类型的测量
/// Stop measuring a specified type of data
/// @param type 测量类型。Type of measurement.
/// @param completion 确认回调。Callback when the command is acknowledged.
/// @discussion YES表示成功发送指令，NO表示重复发送或发送失败。YES indicates the command was sent successfully, NO indicates a duplicate or failure.
- (BOOL)stopMeasurementWithType:(BTMeasureType)type completion:(void (^)(BOOL ackReceived))completion;


/// 切换到ECG延迟模式
/// Switch to ECG latency mode
/// @param completion 确认回调。Callback when the command is acknowledged.
/// @discussion YES表示成功发送指令，NO表示发送失败。YES indicates the command was sent successfully, NO indicates a failure.
- (BOOL)sendECGLatencyModeWithStatus:(BOOL)isEnable Completion:(void (^)(BOOL success))completion;

///// 开始ECG测量
///// Start ECG measurement
///// @param completion 确认回调。Callback when the command is acknowledged.
///// @param dataBlock 数据回调。Callback when a batch of data packets is received.
///// @param dataEndBlock 数据结束回调。Callback when the data collection is complete.
///// @discussion YES表示成功发送指令并接收到ACK，NO表示发送失败或ACK失败。YES indicates the command was sent successfully and ACK received, NO indicates a failure.
//- (BOOL)startECGWithCompletion:(void (^)(BOOL success))completion
//                         data:(void (^)(NSArray<BTECGPacket *> *pkts))dataBlock
//                      dataEnd:(void (^)(NSArray<BTECGPacket *> *allPkts))dataEndBlock;

#pragma mark - 血糖测量
/// 开始血糖测量
/// Start blood glucose measurement
/// @param completion 确认回调。Callback when the command is acknowledged.
/// @param pktBlock 数据包回调。Callback for each received blood glucose packet.
/// @param allBlock 所有数据包结束回调。Callback when all packets have been received and data collection is complete.
/// @discussion YES表示成功发送指令并接收到ACK，NO表示发送失败或ACK失败。YES indicates the command was sent successfully and ACK received, NO indicates a failure.
- (BOOL)startGluMeasureWithAck:(void (^)(BOOL success))completion
                          pkt:(void (^)(BTGluPacket *pkt))pktBlock
                     allPkts:(void (^)(NSArray<BTGluPacket *> *allPkts))allBlock;


/// 开始测量指定类型的数据
/// Start measuring specified type of data
/// @param type 测量类型。Type of measurement.
/// @param ackCompletion 确认回调，表示戒指是否确认开始测量。Callback indicating whether the ring acknowledged the start of the measurement.
/// @param resultCompletion 结果回调，当结果接收时调用。Callback triggered when the measurement result is received.
/// @discussion 返回值为 YES 表示成功发送指令，NO 表示重复发送或发送失败。The return value YES indicates the command was sent successfully, while NO indicates a duplicate request or failure.
- (BOOL)startMeasureWithType:(BTMeasureType)type
                           acked:(void (^)(BOOL acked))ackCompletion
                  resultReceived:(void (^)(BTMeasureResult * _Nullable result))resultCompletion;


/// 开始ECG测量
/// Start ECG measurement
/// @param handPreference 手佩戴偏好，0x01 表示左手佩戴，0x02 表示右手佩戴。
///                       Hand preference, 0x01 indicates left-hand wear, 0x02 indicates right-hand wear.
/// @param completion 确认回调。Callback when the command is acknowledged.
///                   YES 表示成功发送指令并接收到 ACK，NO 表示发送失败或 ACK 失败。
///                   YES indicates the command was sent successfully and ACK received, NO indicates a failure.
/// @param dataBlock 数据回调。每收到一批数据包时触发。Callback when a batch of data packets is received.
///                  该 block 会持续触发直到结束信号被接收。This block is continuously triggered until the end signal is received.
/// @param dataEndBlock 数据结束回调。当数据采集结束时触发，返回所有数据包及诊断结果。Callback when the data collection is complete, returning all packets and diagnosis result.
/// @discussion YES表示成功发送指令并接收到ACK，NO表示发送失败或ACK失败。YES indicates the command was sent successfully and ACK received, NO indicates a failure.
- (BOOL)startECGWithHandPreference:(UInt8)handPreference
                        completion:(void (^)(BOOL success))completion
                              data:(void (^)(NSArray<BTECGPacket *> *pkts))dataBlock
                           dataEnd:(void (^)(NSArray<BTECGPacket *> *allPkts, NSDictionary *diagnosisResult))dataEndBlock;


@end

NS_ASSUME_NONNULL_END
