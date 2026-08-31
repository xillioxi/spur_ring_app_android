//
//  BTService.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/11.
//

#import <Foundation/Foundation.h>
#import <RingSDK/Ring.h>
#import <RingSDK/BTDevice.h>
#import <RingSDK/RTKOTAUpdater.h>
#import <RingSDK/BTBase.h>
#import <RingSDK/BTTouch.h>
#import <RingSDK/BTMeasure.h>
#import <RingSDK/BTHealth.h>
#import <RingSDK/BTSOS.h>
#import <RingSDK/BTSleep.h>
#import <RingSDK/BTOTAChecker.h>
#import <RingSDK/BTSport.h>
#import <RingSDK/BTVibration.h>
#import <RingSDK/BTVibrationConfig.h>


NS_ASSUME_NONNULL_BEGIN

/**
 * 蓝牙状态变化的回调类型。
 * Callback type for Bluetooth state changes.
 */
typedef void (^BLEStateBlock)(CBManagerState state);

/**
 * 扫描戒指的回调类型。
 * Callback type for ring scanning.
 */
typedef void (^RingScanBlock)(NSArray<Ring *> *rings);

/**
 * 戒指状态变化的回调类型。
 * Callback type for ring status changes.
 */
typedef void (^RingStatusBlock)(BTDeviceStatus status);

/**
 * 监听戒指的充电状态和电池电量的变化的回调。
 * Callback for monitoring changes in the charging status and battery level of a ring.
 */
typedef void (^RingChargeBlock)(BTPowerModel *powerModel);

/**
 * 蓝牙服务类，管理设备通讯和状态。
 * Bluetooth service class managing device communication and status.
 */
typedef void (^BTCommandBlock)(NSData *data);


@interface BTService : NSObject

@property (nonatomic, copy) BTCommandBlock commandBlock;
/// 充电状态处理程序
/// Charging status handler
@property (nonatomic, copy) RingChargeBlock chargeHandler;

/// 设备是否已连接
/// Whether the device is connected
@property (nonatomic, assign) BOOL isConnected;

/// 蓝牙是否已开启
/// Whether Bluetooth is powered on
@property (nonatomic, assign) BOOL isPoweredOn;

/// 蓝牙是否有访问权限
/// Whether Bluetooth permiss is denied
@property (nonatomic, assign) BOOL isPermissionDenied;

/// 基础请求对象
/// Basic request object
@property (nonatomic, strong) BTBase *baseReq;

/// 触控请求对象
/// Touch request object
@property (nonatomic, strong) BTTouch *touchReq;

/// 测量请求对象
/// Measure request object
@property (nonatomic, strong) BTMeasure *measureReq;

/// 健康请求对象
/// Health request object
@property (nonatomic, strong) BTHealth *healthReq;

/// SOS请求对象
/// SOS request object
@property (nonatomic, strong) BTSOS *sosReq;

/// 睡眠请求对象
/// Sleep request object
@property (nonatomic, strong) BTSleep *sleepReq;

/// 睡眠请求对象
/// Sleep request object
@property (nonatomic, strong) BTSport *sportReq;

/// 震动请求对象
/// Sleep request object
@property (nonatomic, strong) BTVibration *vibrationReq;

/// 震动模式设置请求对象
/// Sleep request object
@property (nonatomic, strong) BTVibrationConfig *vibrationConfigReq;


// ECG专用通道
@property (nonatomic, strong, nullable) CBCharacteristic *writeECGCharacteristic;
@property (nonatomic, strong, nullable) CBCharacteristic *notifyECGCharacteristic;
/**
 * 获取单例对象。
 * Get the singleton instance.
 *
 * @return 单例对象。
 * @return The singleton instance.
 */
+ (BTService *)shared;

/**
 * 获取版本号。
 * Get the version number.
 *
 * @return 当前版本号字符串。
 * @return The current version number as a string.
 */
+ (NSString *)version;

/**
 * 设置应用唯一标识。
 * Set the unique application ID.
 *
 * @param appId 应用的唯一标识。 The unique application identifier.
 */
- (void)setUniqueAppIDKey:(NSString *)appId;

/**
 * 设置睡眠和健康数据回调的额外延迟。
 * Set the additional delay for sleep and health data callbacks.
 *
 * @param delay 回调的额外延迟（秒）。 The additional delay (in seconds) for the callback.
 */
- (void)setCallbackDelay:(CGFloat)delay;

/**
 * 开始扫描戒指。
 * Start scanning for rings.
 */
- (void)startScan;

/**
 * 停止扫描戒指。
 * Stop scanning for rings.
 */
- (void)stopScan;

/**
 * 更新设备扫描的回调。
 * Update device scanning callback.
 *
 * @param scanHandle 扫描结果的回调处理。 Callback handler for scan results.
 */
- (void)scanningDeviceUpdated:(RingScanBlock)scanHandle;

/**
 * 绑定戒指。
 * Bind a ring.
 *
 * @param macAddr 戒指的 MAC 地址。 MAC address of the ring.
 */
- (void)bindDevice:(NSString *)macAddr;

///**
// * 绑定戒指。Bind a ring.
// * 允许 completion block 为空，表示不需要后续回调处理。
// * Allows the completion block to be nil, indicating that no follow-up callback handling is needed.
// *
// * @param peripheral 戒指的蓝牙外设对象。The Bluetooth peripheral object of the ring.
// * @param completion 完成后将通过此回调传递认证模型结果。it will be called with the authentication model result upon completion.
// */
//- (void)bindDevice:(CBPeripheral *)peripheral completion:(void (^)(BTAuthModel *authModel))completion;

/**
 * 解绑戒指。
 * Unbind a ring.
 */
- (void)unbindDevice;

/**
 * 获取已绑定的戒指设备。
 * Get the paired ring device.
 *
 * @return 已绑定的戒指设备。 The paired ring device.
 */
- (nullable BTDevice *)getPairedDevice;

/**
 * 切换自动重连的戒指设备。
 * set the paired ring device.
 */
- (void)setPairedDevice:(BTDevice *)device;

/**
 * 监听蓝牙设备状态更新。
 * Listen for Bluetooth device status updates.
 *
 * @param bleStateHandler 蓝牙状态更新的回调。 Callback for Bluetooth state updates.
 */
- (void)bleStatusUpdated:(BLEStateBlock)bleStateHandler;

/**
 * 监听戒指状态更新。
 * Listen for ring status updates.
 *
 * @param ringStateHandler 戒指状态更新的回调。 Callback for ring status updates.
 */
- (void)ringStatusUpdated:(RingStatusBlock)ringStateHandler;

/**
 * 向戒指发送数据。
 * Send data to the ring.
 *
 * @param data 发送到戒指的数据。Data to be sent to the ring.
 * @return 返回是否成功发送数据的BOOL值。Returns a BOOL indicating whether the data was successfully sent.
 * @deprecated 该方法已废弃，请使用 `-send:completion:` 方法。This method is deprecated. Please use `-send:completion:` instead.
 */
//- (BOOL)send:(NSData *)data __attribute__((deprecated("Use -send:completion: instead")));

/**
 * 向戒指发送数据并立即返回是否可以启动发送过程。
 * Sends data to the ring and immediately returns whether the sending process can be initiated.
 *
 * @param data 发送到戒指的数据。Data to be sent to the ring.
 * @param completion 异步回调，返回是否成功发送数据的BOOL值。An asynchronous callback, returning a BOOL indicating whether the data was successfully sent.
 * @return BOOL 立即返回是否成功启动发送过程的指示。Returns immediately with a BOOL indicating whether the sending process was successfully initiated.
 */
- (BOOL)send:(NSData *)data completion:(void (^)(BOOL success))completion;

/**
 * 向戒指发送ECG相关数据并立即返回是否可以启动发送过程。
 * Sends ECG data to the ring and immediately returns whether the sending process can be initiated.
 *
 * @param data 发送到戒指的ECG数据。ECG data to be sent to the ring.
 * @param completion 异步回调，返回是否成功发送ECG数据的BOOL值。An asynchronous callback, returning a BOOL indicating whether the ECG data was successfully sent.
 * @return BOOL 立即返回是否成功启动发送过程的指示。Returns immediately with a BOOL indicating whether the sending process was successfully initiated.
 */
- (BOOL)sendECGData:(NSData *)data completion:(void (^)(BOOL success))completion;

/**
 * 检查最新的 OTA 升级包。
 * Check the latest OTA update package.
 *
 * @param model 设备的相关信息模型。 The model containing device-related information.
 * @param appName 应用程序名称。The name of the application.
 * @param authenticationID 授权的云服务认证ID。The authorized cloud service authentication ID.
 * @param authenticationKey 授权的云服务认证KEY。The authorized cloud service authentication KEY.
 * @param callback OTA 检查和下载过程中的回调。 Callback during the OTA check and download process.
 */
- (void)checkOTAUpdateWith:(BTAboutModel *)model appName:(NSString *)appName authenticationID:(NSString *)authenticationID authenticationKey:(NSString *)authenticationKey Callback:(OTACheckCompletionHandler)callback;

/**
 * 选择文件进行 OTA 升级。
 * Select a file for OTA updates.
 *
 * @param callback 升级过程中的回调。 Callback during the upgrade process.
 */
- (void)selectOTAFileWithUpdateCallback:(OTAUpdateCallback)callback;

/**
 * 使用文件 URL 开始 OTA 升级。
 * Start OTA upgrade using a file URL.
 *
 * @param fileURL 文件的 URL。 URL of the file.
 * @param callback 升级过程中的回调。 Callback during the upgrade process.
 */
- (void)startUpgradeWithFileURL:(NSURL *)fileURL updateCallback:(OTAUpdateCallback)callback;

/**
 * 使用 OTAVersion 模型开始 OTA 升级。
 * Start OTA upgrade using an OTAVersion model.
 *
 * @param version 包含固件版本信息的模型。 The model containing firmware version information.
 * @param callback 升级过程中的回调。 Callback during the upgrade process.
 */
- (void)startUpgradeWithOTAVersion:(OTAVersion *)version updateCallback:(OTAUpdateCallback)callback;

/**
 * 设置自动重新连接状态。
 * Set the auto-reconnection state.
 *
 * @param isEnabled 是否启用自动重新连接，true 会立即重连，false 会断开并取消重连。 Whether auto-reconnection is enabled.
 */
- (void)setAutoReconnectionEnabled:(BOOL)isEnabled;
/**
 * 获取当前是否启用了自动重连功能。
 * Retrieve the current state of the auto-reconnection feature.
 *
 * @return BOOL 返回 YES 如果自动重连功能已启用，默认为 YES。
 * @return BOOL Returns YES if auto-reconnection is enabled, defaults to YES.
 */
-(BOOL)getIsAutoReconnectionEnabled;

/**
 * 启用或禁用蓝牙数据日志记录。
 * Enable or disable logging for Bluetooth data.
 *
 * @param isEnable YES 启用，NO 禁用。 Pass YES to enable, NO to disable.
 */
-(void)setLogEnable:(BOOL)isEnable;

/**
 * 是否启用或禁用蓝牙数据日志记录。
 * whether Enable or disable logging for Bluetooth data.
 *
 *@return BOOL YES 启用，NO 禁用。 Pass YES to enable, NO to disable.
 */
-(BOOL)getLogIsEnable;

/**
 * 获取蓝牙数据日志文件的路径。
 * Get the file path for Bluetooth data logs.
 * @return NSString 日志文件路径。NSString Path of the log file.
 */
-(NSString *)getLogPath;

/**
 * 清除所有的日志文件。
 * Clear all log files.
 *
 * @discussion 此方法删除所有存储在日志目录中的日志文件，用于释放空间或保持隐私。
 * @discussion This method deletes all log files stored in the log directory, used for freeing up space or maintaining privacy.
 */
-(void)clearLogs;

/**
 * 获取系统已连接的设备列表。
 * Get the list of system-connected devices.
 *
 * @discussion 此方法返回所有已连接到系统的蓝牙设备列表，通常用于检测设备是否已连接并执行进一步操作。
 * @discussion This method returns a list of all Bluetooth devices connected to the system, typically used to check if devices are connected and to perform further operations.
 *
 * @return 返回已连接的蓝牙设备列表。
 * @return Returns an array of connected Bluetooth devices.
 */
- (NSArray<CBPeripheral *> *)getSystemConnectedDevices;

// 从已经连接的列表中找到已绑定设备的对象
- (nullable CBPeripheral *)getBindedDeviceObjectFromSystem;

// 重新初始化蓝牙管理中心
-(void)restartCoreBluetoothCenter;

@property(nonatomic,assign)BOOL isAuthorize;

- (void)clearDiscoveredRings;


//MARK: -新增通过传入蓝牙外设连接/绑定
- (void)bindDeviceWithPeripheral:(CBPeripheral *)peripheral;

//MARK: - 断开当前设备
- (void)disConnectDevice;

- (nullable CBPeripheral *)currentPeripheral;

//MARK: -重连
- (void)reConnectDevice;

@end

NS_ASSUME_NONNULL_END
