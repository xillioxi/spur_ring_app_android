//
//  BTDevice.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/20.
//

#import <Foundation/Foundation.h>


NS_ASSUME_NONNULL_BEGIN

/// BTDevice 类用于表示一个蓝牙设备的基本信息。
/// The BTDevice class represents the basic information of a Bluetooth device.
@interface BTDevice : NSObject

/// 设备的唯一标识符。
/// The unique identifier of the device.
@property (nonatomic, strong) NSString *uuid;

/// 设备的名称。
/// The name of the device.
@property (nonatomic, strong) NSString *name;

/// 设备的MAC地址。
/// The MAC address of the device.
@property (nonatomic, strong) NSString *macAddress;

/// 使用UUID、名称和MAC地址初始化一个蓝牙设备对象。
/// Initializes a Bluetooth device object with a UUID, name, and MAC address.
/// @param uuid 设备的唯一标识符  The unique identifier of the device.
/// @param name 设备的名称。The name of the device.
/// @param macAddress 设备的MAC地址。The MAC address of the device.
- (instancetype)initWithUUID:(NSString *)uuid name:(NSString *)name macAddress:(NSString *)macAddress;

/// 比较两个蓝牙设备基于名称的排序。
/// Compares two Bluetooth devices based on their names for sorting.
/// @param otherDevice 另一个蓝牙设备。 otherDevice Another Bluetooth device.
/// @return 返回比较结果，用于数组排序等。Returns the comparison result, used for array sorting, etc.
- (NSComparisonResult)compareByName:(BTDevice *)otherDevice;

/// 打印设备的UUID、名称和MAC地址，返回自动换行的字符串。
/// Prints the UUID, name, and MAC address of the device, returns a string with automatic line breaks.
/// @return 包含设备信息的字符串。Returns a string containing device information.
- (NSString *)debugPrint;


@end

NS_ASSUME_NONNULL_END
