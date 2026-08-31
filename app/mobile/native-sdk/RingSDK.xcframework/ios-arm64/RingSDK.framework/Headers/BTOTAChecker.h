//
//  BTOTAChecker.h
//  AIZORing
//
//  Created by kaoji on 2024/5/20.
//

#import <Foundation/Foundation.h>
#import <RingSDK/RingDef.h>
#import <RingSDK/BTOTAModel.h>
#import <RingSDK/BTAboutModel.h>

NS_ASSUME_NONNULL_BEGIN

/// 类型定义回调处理器，用于固件检查操作的结果。
/// Type definition for a callback handler used for the results of the firmware check operation.
typedef void(^OTACheckCompletionHandler)(OTAVersion * _Nullable otaVersion, NSError * _Nullable error);

/// BTOTAChecker 类用于检查是否有新的固件更新并处理结果。
/// The BTOTAChecker class is used to check for new firmware updates and handle the results.
@interface BTOTAChecker : NSObject

/// 执行OTA检查并通过完成处理器返回结果。
/// Performs an OTA check and returns the results via a completion handler.
/// @param about 设备信息。The device information.
/// @param appName 应用程序名称。The name of the application.
/// @param authenticationID 授权的云服务认证ID。The authorized cloud service authentication ID.
/// @param authenticationKey 授权的云服务认证KEY。The authorized cloud service authentication KEY.
/// @param completionHandler 用于接收OTA检查结果的回调。The block to call with the results of the OTA check.
- (void)checkOTAWith:(BTAboutModel *)about appName:(NSString *)appName authenticationID:(NSString *)authenticationID authenticationKey:(NSString *)authenticationKey Completion:(OTACheckCompletionHandler)completionHandler;
@end

NS_ASSUME_NONNULL_END
