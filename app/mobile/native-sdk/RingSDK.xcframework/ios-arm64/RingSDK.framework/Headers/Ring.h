//
//  Ring.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/11.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>

NS_ASSUME_NONNULL_BEGIN

/// 设备类，用于管理蓝牙设备相关信息
/// Class for managing Bluetooth device information
@interface Ring : NSObject

/// 设备名称
/// Device name
@property (nonatomic, strong) NSString *name;

/// 设备UUID字符串，唯一标识设备
/// Device UUID string, unique identifier
@property (nonatomic, strong) NSString *uuidString;

/// 设备MAC地址（可选）
/// Device MAC address (optional)
@property (nonatomic, strong, nullable) NSString *macAddress;

/// 信号强度，用于表示信号质量
/// Signal strength, indicates signal quality
@property (nonatomic, assign) int rssi;

/// 设备是否被系统连接
/// Whether the device is connected by the system
@property (nonatomic, assign, readonly) BOOL isSystemConnected;

/// 构建Ring实例
/// Constructs a Ring instance
/// @param name 设备名称 Device name
/// @param uuidString 设备UUID Device UUID
/// @param macAddress 设备MAC地址（可选） Device MAC address (optional)
/// @param rssi 信号强度 Signal strength
- (instancetype)initWithName:(NSString *)name
                   uuidString:(NSString *)uuidString
                   macAddress:(nullable NSString *)macAddress
                         rssi:(int)rssi;

/// 从广告数据构建Ring实例
/// Constructs a Ring instance from advertisement data
/// @param advertisementData 蓝牙设备广告数据 Bluetooth device advertisement data
/// @param rssi 信号强度 Signal strength
+ (nullable Ring *)fromAdvertisementData:(NSDictionary<NSString *, id> *)advertisementData rssi:(int)rssi;

/// 将Ring对象转换为JSON字符串
/// Converts Ring object to JSON string
- (NSString *)toJSONString;

/// 从JSON字符串构建Ring实例
/// Constructs a Ring instance from a JSON string
/// @param jsonString JSON格式字符串 JSON formatted string
+ (Ring *)fromJSONString:(NSString *)jsonString;

/// 将Ring对象转换为字典
/// Converts Ring object to a dictionary
- (NSDictionary *)toDictionary;

/// 蓝牙外设对象
/// Bluetooth peripheral object
@property (nonatomic, strong, nullable) CBPeripheral *peripheral;

@end

NS_ASSUME_NONNULL_END
