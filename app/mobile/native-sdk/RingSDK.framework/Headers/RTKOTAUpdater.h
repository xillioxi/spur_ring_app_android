//
//  RTKOTAUpdater.h
//  RingSDK
//
//  Created by kaoji on 5/25/24.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import <RingSDK/RingDef.h>
#import <RingSDK/BTOTAModel.h>

/// OTA升级状态回调。
/// Callback type for OTA update process.
typedef void(^OTAUpdateCallback)(BTOTAUpdateStatus status, float progress, NSError *__nullable error);

NS_ASSUME_NONNULL_BEGIN

/// OTA更新器类用于处理设备的无线升级。
/// The RTKOTAUpdater class manages over-the-air updates for devices.
@interface RTKOTAUpdater : NSObject

/// 获取RTKOTAUpdater的单例实例。
/// Returns the singleton instance of the RTKOTAUpdater.
+ (RTKOTAUpdater *)sharedInstance;

/// 选择OTA文件并初始化升级过程。
/// Selects an OTA file and initiates the update process.
/// @param peripheral 蓝牙外设对象，与设备通信。
/// @param callback 更新过程中的回调，返回更新状态和进度。
/// @discussion 此方法用于从用户选定的文件开始设备的OTA升级过程。
/// Initiates the OTA update process from a user-selected file for the specified Bluetooth peripheral.
- (void)selectOTAFileWithPeripheral:(CBPeripheral *)peripheral updateCallback:(OTAUpdateCallback)callback;

/// 通过指定的文件URL开始升级。
/// Starts the upgrade process with the specified file URL.
/// @param fileURL 文件URL，指向存储OTA升级文件的位置。
/// @param peripheral 蓝牙外设对象，用于升级设备。
/// @param callback 更新过程中的回调，报告升级状态和进度。
/// @discussion 使用此方法可以直接通过文件URL开始设备的OTA升级。
/// Uses a file URL to directly start the OTA upgrade process for the specified Bluetooth peripheral.
- (void)startUpgradeWithFileURL:(NSURL *)fileURL peripheral:(CBPeripheral *)peripheral updateCallback:(OTAUpdateCallback)callback;

/// 通过OTA模型直接开始升级。
/// Starts an upgrade directly using an OTA model.
/// @param version OTA版本模型，包含升级所需的所有数据。
/// @param peripheral 蓝牙外设对象，用于实施升级。
/// @param callback 更新过程中的回调，报告升级状态和进度。
/// @discussion 此方法允许用户使用预先定义的OTA模型来进行设备升级，便于管理多个版本。
/// Allows for an upgrade using a predefined OTA model, facilitating version management for the device.
- (void)startUpgradeWithBTOTAModel:(OTAVersion *)version peripheral:(CBPeripheral *)peripheral updateCallback:(OTAUpdateCallback)callback;

@end

NS_ASSUME_NONNULL_END
