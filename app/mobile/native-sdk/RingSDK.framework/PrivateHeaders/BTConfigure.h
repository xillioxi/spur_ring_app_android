//
//  BTConfigure.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/11.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 `BTConfigure` 是一个用于管理和配置蓝牙连接所需的各种参数的单例类。

 @discussion 这个类提供了一系列配置选项，包括应用版本、硬件供应商ID、设备UUID，以及是否为中文语言环境。
             它还包括了用于蓝牙服务的特定UUIDs，这些UUIDs用于BLE通信中的写入和通知特性。
 */
@interface BTConfigure : NSObject

/// 用于最终结果回调延迟
@property (nonatomic, assign) CGFloat callbackDelay;

/// 协议版本号
@property (nonatomic, assign) NSInteger protocolVersion;

/// 应用版本号
@property (nonatomic, strong) NSString *appVersion;

/// 硬件供应商ID
@property (nonatomic, strong) NSString *vendorID;

/// 设备的UUID
@property (nonatomic, strong) NSString *appID;

/// 戒指的表示
@property (nonatomic, strong) NSString *ringIdentifier;

/// 标记是否是中文语言环境
@property (nonatomic, assign) BOOL isCNLang;

/// 服务的UUID，用于建立BLE服务通道
@property (nonatomic, strong, readonly) NSString *serviceUUID;

/// 写特性的UUID，用于BLE设备的写入操作
@property (nonatomic, strong, readonly) NSString *writeUUID;

/// 通知特性的UUID，用于接收BLE设备的通知
@property (nonatomic, strong, readonly) NSString *notifyUUID;

/// 写特性的UUID，用于ECG回复ACK
@property (nonatomic, strong, readonly) NSString *writeECGUUID;

/// 通知特性的UUID，用于接收ECG数据包
@property (nonatomic, strong, readonly) NSString *notifyECGUUID;

//单例
+ (BTConfigure *)shared;

@end

NS_ASSUME_NONNULL_END
