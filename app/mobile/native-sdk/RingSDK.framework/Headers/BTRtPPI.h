//
//  BTRtPPI.h
//  RingSDK
//
//  Created by 黄建华 on 2025/9/16.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@class BTRtPPIModel;

/**
 *  BTRtPPI
 *  实时情绪测量(PPI/LOVING)管理类
 *  Singleton manager for real-time emotion measurement.
 */
@interface BTRtPPI : NSObject

/// 获取单例实例
/// @return 全局唯一的 BTRtPPI 对象 (The shared singleton instance)
+ (instancetype)sharedInstance;

/// 实时数据模型回调
/// Called when new parsed BTRtPPIModel data is available.
/// @param model 解析后的实时数据模型 (Parsed real-time data model)
typedef void (^BTRtPPIModelBlock)(BTRtPPIModel *model);

#pragma mark - 实时测量指令 (Real-Time Measurement Commands)

/**
 * 查询情绪实时测量状态
 *
 * 发送指令后设备返回当前实时测量的状态。
 *
 * @param completion 回调返回以下参数：
 *   - status:   BTRTPPIStatus  当前测量状态
 *               (e.g. Idle / Measuring / Error)
 *   - type:     BTRTPPIType    当前正在进行的测量类型
 *   - timestamp:uint64_t       测量开始时间戳(毫秒，自1970起)
 *
 * @return
 *   YES  指令发送成功（不代表设备返回成功）
 *   NO   指令发送失败（未能写入蓝牙通道等原因）
 */
- (BOOL)queryEmotionMeasureStatusWithCompletion:
    (void (^)(BTRTPPIStatus status,
              BTRTPPIType type,
              uint64_t timestamp))completion;

/**
 * 启动实时情绪测量
 *
 * @param type       测量类型 (Measurement type)
 *                   例如 PPI 或 LOVING，不同类型会影响数据格式。
 *
 * @param completion 回调返回以下参数：
 *   - type:   BTRTPPIType  启动的测量类型
 *   - result: Byte        0x01 表示启动成功，
 *                         其它值表示启动失败或设备拒绝
 *
 * @return
 *   YES  表示指令发送到设备成功
 *   NO   表示发送失败（通信层面错误）
 */
- (BOOL)startRealTimeMeasureWithType:(BTRTPPIType)type
                          completion:(void (^)(BTRTPPIType type,
                                               Byte result))completion;

/**
 * 停止实时情绪测量
 *
 * @param type       测量类型，与启动时保持一致
 *
 * @param completion 回调返回以下参数：
 *   - type:   BTRTPPIType  停止的测量类型
 *   - result: Byte        0x01 表示停止成功，
 *                         其它值表示失败
 *
 * @return
 *   YES  指令发送成功
 *   NO   指令发送失败
 */
- (BOOL)stopRealTimeMeasureWithType:(BTRTPPIType)type
                         completion:(void (^)(BTRTPPIType type,
                                              Byte result))completion;

/**
 * 处理设备推送的实时数据
 *
 * 内部会解析数据并：
 *   1. 回调 rtPPIDateHandle 返回 BTRtPPIModel。
 *   2. 如果需要自动 ACK，会自动回复设备。
 *
 * @param contentData 原始数据包
 *   - 内容格式遵循设备协议
 *   - 需保证完整性（长度 >= 10 字节以上）
 */
- (void)processUncauchCommand:(NSData *)contentData;

#pragma mark - 日志 (Logging)

/**
 * 记录日志
 *
 * @param message 日志内容
 *   - 建议为简短字符串
 *   - 内部可能写入文件或控制台
 */
- (void)logMessage:(NSString *)message;

#pragma mark - 回调属性 (Callbacks)

/// 实时数据回调
/// 当成功解析到设备推送的实时数据时调用。
/// @note 在主线程回调，确保 UI 操作安全。
@property (nonatomic, copy) BTRtPPIModelBlock rtPPIDateHandle;

/**
 * 启动情绪测量（Emotion Measurement）
 *
 * @param type        测量类型（BTRTPPIType）
 *                    例如：PPI、LOVING 等，不同类型会影响测量的数据格式。
 *
 * @param duration         测量时长（秒），占 2 字节，以 **大端模式（Big-Endian）** 发送给设备。
 *                    - 默认值：300 秒（5 分钟）
 *                    - 范围：1 秒 ~ 64800 秒（18 小时）
 *                    - 超过范围则自动裁剪到有效区间
 *
 * @param mode        测量模式，占 1 字节。
 *                    可选值：
 *                      1 = APP 远程控制模式（由 APP 控制测量开始与结束）
 *                      2 = 计时模式（设备按 duration 自动测量并结束）
 *
 * @param gender   性别（1 byte）：0x01 男，0x02 女
 * @param age      年龄（1 byte，单位：岁，0~254）
 * @param height   身高（1 byte，单位：cm，0~254）
 * @param weight   体重（1 byte，单位：kg，0~254）
 * @param hand     佩戴手（1 byte）：0x01 左手，0x02 右手
 *
 * @param completion  执行结果回调，返回以下参数：
 *                      - type:   实际启动的测量类型（同入参 type）
 *                      - result: Byte
 *                                 0x01 表示设备成功接受并启动测量
 *                                 其它值表示启动失败或设备拒绝
 *
 * @return
 *   YES  表示指令已成功发送到设备（通信层传输成功，不代表设备同意）
 *   NO   表示指令发送失败（如蓝牙未连接、通道不可用、打包失败等）
 */
- (BOOL)startEmotionMeasurementWithType:(BTRTPPIType)type
                               duration:(NSUInteger)duration
                                   mode:(uint8_t)mode
                                 gender:(Byte)gender
                                    age:(Byte)age
                                 height:(Byte)height
                                 weight:(Byte)weight
                                   hand:(Byte)hand
                             completion:(void (^)(BTRTPPIType type,
                                                  Byte result))completion;


@end

NS_ASSUME_NONNULL_END
