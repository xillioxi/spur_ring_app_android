//
//  BTBase.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/11.
//


#import <Foundation/Foundation.h>
#import <RingSDK/BTPowerModel.h>
#import <RingSDK/BTUserPrefs.h>
#import <RingSDK/BTIntervalModel.h>
#import <RingSDK/BTRealDataModel.h>

NS_ASSUME_NONNULL_BEGIN

@class BTAccept;

/**
 * BTBase 发送请求至终端
 * BTBase sends requests to the device
 */
@interface BTBase : NSObject

/// 发送鉴权请求。Send an authentication request.
/// @param completion 完成后的回调。Completion handler.
- (void)authorize:(void (^)(BTDeviceStatus status))completion;

/// 获取电源状态。Retrieve power status.
- (void)fetchPowerStatus;

/// 执行设备操作。Perform a device operation.
/// @param type 操作类型。Operation type.
/// @param completion 完成后的回调。Completion handler.
- (void)executeOperation:(BTOperationType)type completion:(void (^)(void))completion;

/// 获取设备配置。Fetch device configuration.
/// @param type 配置类型。Configuration type.
/// @param completion 完成后的回调，返回模型和类型。Completion handler with model and type.
- (void)fetchConfig:(BTConfigType)type completion:(void (^)(id model, BTConfigType type))completion;

/// 向设备发送用户设置。Send user settings to the device.
/// @param settings 用户设置。User settings.
/// @param completion 完成后的回调，返回操作是否成功。Completion handler with success status.
- (void)sendSettings:(BTUserPrefs *)settings completion:(void (^)(BOOL success))completion;

/// 设置设备的测量时间间隔。Set the device's measurement interval.
/// @param measureTime 测量时间间隔，范围0-120分钟。Measurement interval, range 0-120 minutes.
/// @param completion 完成后的回调，返回操作是否成功。Completion handler with success status.
- (void)setDeviceMeasureTime:(NSInteger)measureTime completion:(void (^)(BOOL success))completion;

/// 查询设备的自动监测间隔设置。Query the device for automatic measurement interval settings.
/// @param completion 完成后的回调，返回操作是否成功和模型。Completion handler with success status and model.
- (void)queryMeasurementInterval:(void (^)(BOOL success, BTIntervalModel * _Nullable model))completion;

/// 查询硬件日志。Query the hardware log.
/// @param completion 返回操作是否成功和完整日志字符串。Completion handler with success status and full log.
/// @param logPartHandler 返回已接收数据包数和字节数。Handler for packets and bytes received.
- (void)queryHardwareLog:(void (^)(BOOL success, NSString *logs))completion
        onLogReceived:(void (^)(NSUInteger packetsReceived, NSUInteger bytesReceived))logPartHandler;

/// 查询设备重启原因日志。
/// Query the device reboot reason log.
/// @param completion 完成回调，返回重启原因的完整日志字符串。Completion handler that returns the full reboot reason log as a string.
/// @return YES 表示查询指令已成功发送，NO 表示发送失败。YES indicates that the query command was successfully sent, NO indicates a failure.
- (BOOL)queryRebootReason:(void (^)(NSString *reasonString))completion;


- (BOOL)queryRealData:(void (^)(BTRealDataModel * _Nullable model))completion;

// 戒指名称字节数组，最长 18 字芬建议 UTF-8 编码
- (BOOL)setDeviceName:(Byte *)byteData completion:(void (^)(BOOL success))completion;


// 戒指SN字节数组，最长20个字符，由大小写字母和数字组成；ASCII字符编码
- (BOOL)setDeviceSN:(Byte *)byteData length:(NSUInteger)length completion:(void (^)(BOOL success))completion ;

// 查询睡眠勿扰模式返回
- (void)querySleepNotDisturb:(void (^)(BOOL success))completion;

// 设置睡眠勿扰模式返回
- (void)setSleepNotDisturb:(BOOL)state  result:(void (^)(BOOL success))completion;

// MARK: - 透传数据
- (void)sendTransparentData:(NSData *)data completion:(void (^)(BOOL success))completion;

- (void)sendOtaRest;

@end

NS_ASSUME_NONNULL_END
