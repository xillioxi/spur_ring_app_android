//
//  BTFeatureModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/23.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// BTFeatureModel 类用于封装蓝牙设备支持的功能。
/// The BTFeatureModel class encapsulates the features supported by a Bluetooth device.
@interface BTFeatureModel : NSObject

/// 是否支持触控开关。
/// Indicates if touch switch is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持 (Supported)
@property (nonatomic, assign) UInt8 isSupportTouchSwitch;

/// 是否支持心率测量。
/// Indicates if heart rate measurement is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持心率测量但不支持远程触发 (Supported, but no remote trigger)
/// 3: 支持心率测量且支持APP远程触发 (Supported with remote trigger via app)
@property (nonatomic, assign) UInt8 hrMeasurement;

/// 是否支持睡眠测量。
/// Indicates if sleep measurement is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持睡眠测量但不支持远程触发 (Supported, but no remote trigger)
/// 3: 支持睡眠测量且支持APP远程触发 (Supported with remote trigger via app)
@property (nonatomic, assign) UInt8 sleepMeasurement;

/// 是否支持血氧测试。
/// Indicates if blood oxygen measurement is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持血氧测量但不支持远程触发 (Supported, but no remote trigger)
/// 3: 支持血氧测量且支持APP远程触发 (Supported with remote trigger via app)
@property (nonatomic, assign) UInt8 bloodOxygenMeasurement;

/// 是否支持体温测量。
/// Indicates if body temperature measurement is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持体温测量但不支持远程触发 (Supported, but no remote trigger)
/// 3: 支持体温测量且支持APP远程触发 (Supported with remote trigger via app)
@property (nonatomic, assign) UInt8 bodyTempMeasurement;

/// 是否支持心电测量。
/// Indicates if ECG (electrocardiogram) measurement is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持心电测量但不支持远程触发 (Supported, but no remote trigger)
/// 3: 支持心电测量且支持APP远程触发 (Supported with remote trigger via app)
@property (nonatomic, assign) UInt8 ecgMeasurement;

/// 是否支持生理周期测量。
/// Indicates if menstrual cycle (MC) measurement is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持生理周期测量但不支持远程触发 (Supported, but no remote trigger)
/// 3: 支持生理周期测量且支持APP远程触发 (Supported with remote trigger via app)
@property (nonatomic, assign) UInt8 mcMeasurement;

/// 是否支持SOS功能。
/// Indicates if SOS functionality is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持SOS功能 (Supported)
/// 2: 支持SOS功能且不能关闭 (Supported, cannot be disabled)
@property (nonatomic, assign) UInt8 isSupportSOS;

/// 是否支持手势唤醒触控功能。
/// Indicates if gesture wakeup control is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持 (Supported)
@property (nonatomic, assign) UInt8 isSupportGestureWakeup;

/// SOS触发模式。
/// Indicates the SOS trigger mode.
/// 1: 支持TP触控触发SOS (Support TP touch trigger)
/// 2: 支持手势触发SOS (Support gesture trigger)
/// 3: 同时支持TP触控和手势触发SOS (Support both TP touch and gesture trigger)
@property (nonatomic, assign) UInt8 sosTriggerMode;

/// 支持触控自动休眠时延设置。
/// Indicates if touch control auto-sleep delay settings are supported.
/// 0: 不支持 (Not supported)
/// 1: 支持 (Supported)
@property (nonatomic, assign) UInt8 touchSleepDelay;

/// 支持触控视频模式设置。
/// Indicates if touch control video mode settings are supported.
/// 0: 不支持 (Not supported)
/// 1: 支持 (Supported)
@property (nonatomic, assign) UInt8 touchVideMode;

/// 是否支持特别关爱提醒。
/// Indicates if special care reminders are supported.
/// 0: 不支持 (Not supported)
/// 1: 支持 (Supported)
@property (nonatomic, assign) UInt8 isSupportCareUser;

/// 是否支持网页浏览触控模式。
/// Indicates if touch control for web browsing is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持 (Supported)
@property (nonatomic, assign) UInt8 touchWebMode;

/// 是否支持身体成分测量功能。
/// Indicates if body composition measurement is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持身体成分测量但不支持远程触发 (Supported, but no remote trigger)
/// 3: 支持身体成分测量且支持APP远程触发 (Supported with remote trigger via app)
@property (nonatomic, assign) UInt8 isSupportBC;

/// 是否支持压力测量。
/// Indicates if stress measurement is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持压力测量但不支持远程触发 (Supported, but no remote trigger)
/// 3: 支持压力测量且支持APP远程触发 (Supported with remote trigger via app)
@property (nonatomic, assign) UInt8 isSupportStress;

/// 是否支持一键魔方。
/// Indicates if one-key magic is supported.
/// 0: 不支持 (Not supported)
/// 1: 支持 (Supported)
@property (nonatomic, assign) UInt8 isSupportonKeyMagic;

// 是否支持女性生理周期
@property (nonatomic, assign) UInt8 isSupportMenstrualCycle;

// 是否支持血糖测量
@property (nonatomic, assign) UInt8 isSupportGlu;

// 是否支持血糖测量
@property (nonatomic, assign) UInt8 isSupportVibration;

// 是否支持情绪测量
@property (nonatomic, assign) UInt8 isSupportEmotion;

// 是否支持彩灯
@property (nonatomic, assign) UInt8 isSupportLamp;

// 是否支持触控休眠
@property (nonatomic, assign) UInt8 isSupportTouchSleepMode;

// 是否支持Philps睡眠算法
@property (nonatomic, assign) UInt8 isSupportPhilpsSleep;

/// 使用特定的二进制数据初始化模型。
/// Initializes the model with specific binary data.
/// @param data 用于初始化模型的二进制数据。 Binary data used to initialize the model.
- (instancetype)initWithData:(NSData *)data;

/// 将模型数据转换为JSON字符串。
/// Converts model data into a JSON string.
/// @return 返回模型数据的JSON字符串表示形式。Returns a JSON string representation of the model data.
- (NSString *)toJSONString;

/// 使用从 `initWithJSONString` 方法得到的 JSON 字符串初始化模型的构造函数。
/// Initializer to create an instance from a JSON string, which can be generated by the `toJSONString` method.
- (instancetype)initWithJSONString:(NSString *)jsonString;

// 是否支持06消息通知 新增2025.4.17
@property (nonatomic, assign) UInt8 isSupportMessageNotice;

@property(nonatomic,assign) UInt8 isSupportHandNew;

@property(nonatomic,assign) UInt8 isSupportSleepNotDisturb;

@property(nonatomic,assign) UInt8 isSportMores;// 0默认是之前的运动模式 //1 支持新版多运动模式

@property (nonatomic, assign) UInt8 isSupportRecord;// 0 默认不支持 1 支持戒指录音

@property (nonatomic, assign) UInt8 isUVSupported;
// 0 默认不支持紫外线功能，1 支持紫外线功能

@end

NS_ASSUME_NONNULL_END
