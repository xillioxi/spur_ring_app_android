//
//  BTAuthModel.h
//  AIZOSDK
//
//  Created by kaoji on 8/11/24.
//

#import <Foundation/Foundation.h>
#import <RingSDK/RingDef.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTAuthModel : NSObject

/// 鉴权状态。Authentication status.
@property (nonatomic, assign) BTDeviceStatus status;

/// MAC地址。MAC address.
@property (nonatomic, copy, nullable) NSString *macAddress;

/// 鉴权密码。Authentication password.
@property (nonatomic, copy, nullable) NSString *password;

/// 设备类型。Device type.
@property (nonatomic, copy, nullable) NSString *deviceType;

/// 鉴权结果。Authentication result.
@property (nonatomic, copy, nullable) NSString *authResult;

/// 连接错误原因。Error reason, valid only if status is ConnectFailed or Disconnected.
@property (nonatomic, copy, nullable) NSString *connectErrorReason;

+ (instancetype)modelWithStatus:(BTDeviceStatus)status;
- (NSString *)statusMessageInEnglish;
- (NSString *)statusMessageInChinese;

@end

NS_ASSUME_NONNULL_END
