//
//  BTRtPPIModel.h
//  RingSDK
//
//  Created by 黄建华 on 2025/9/16.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#pragma mark - LOVING 子模型 (LOVING Submodel)
/**
 *  单个 LOVING 采样点数据
 *  Represents a single LOVING sample point.
 */
@interface BTRtLovingPoint : NSObject

/// 心率值 (Heart rate, range: 0~220 bpm)
/// 1 byte, unsigned 8-bit
@property (nonatomic, assign) uint8_t heart;

/// 体温 (Body temperature, unit: 0.1 °C, valid range: 14.2~46.5 °C)
/// 2 bytes, unsigned 16-bit
@property (nonatomic, assign) uint16_t temp;

/// 三轴加速度传感器 X 轴 (G-sensor X-axis)
/// 2 bytes, unsigned 16-bit
@property (nonatomic, assign) uint16_t gSensorX;

/// 三轴加速度传感器 Y 轴 (G-sensor Y-axis)
/// 2 bytes, unsigned 16-bit
@property (nonatomic, assign) uint16_t gSensorY;

/// 三轴加速度传感器 Z 轴 (G-sensor Z-axis)
/// 2 bytes, unsigned 16-bit
@property (nonatomic, assign) uint16_t gSensorZ;

/// 采样时间戳 (Sampling timestamp, milliseconds since epoch)
/// 8 bytes, unsigned 64-bit
@property (nonatomic, assign) uint64_t timeStamp;

/// 时间戳字符串 (Human-readable timestamp string, e.g. “yyyy-MM-dd HH:mm:ss”)
@property (nonatomic, strong) NSString *timeStampString;

@end


#pragma mark - PPI 子模型 (PPI Submodel)
/**
 *  单个 PPI 采样点数据
 *  Represents a single PPI (Pulse-to-Pulse Interval) sample point.
 */
@interface BTRtPPIPoint : NSObject

/// PPI 值，单位毫秒 (PPI value in milliseconds)
/// 2 bytes, unsigned 16-bit
@property (nonatomic, assign) uint16_t ppi;

/// PPI 对应时间戳 (Timestamp in milliseconds since epoch)
/// 8 bytes, unsigned 64-bit
@property (nonatomic, assign) uint64_t ppiTimestamp;

/// 时间戳字符串 (Human-readable timestamp string)
@property (nonatomic, strong) NSString *timestampString;

@end


#pragma mark - BTRtPPI 总模型 (Main Model)
/**
 *  PPI/LOVING 实时数据模型
 *  Encapsulates a full packet of real-time PPI and LOVING data.
 */
@interface BTRtPPIModel : NSObject

/// 设备唯一 ID (Unique device identifier)
@property (nonatomic, strong) NSString *deviceID;

/// 测量开始时间戳 (Measurement start timestamp, milliseconds since epoch)
@property (nonatomic, assign) uint64_t startTimeStamp;

/// 测量开始时间字符串 (Human-readable start time string)
@property (nonatomic, strong) NSString *startTimeStampDateString;

/// 测量类型 (Measurement type)
@property (nonatomic, assign) BTRTPPIType type;

/// 采样频率 (Sampling frequency, Hz)
@property (nonatomic, assign) uint8_t frequency;

/// 单个采样数据长度 (Length of a single sample in bytes)
@property (nonatomic, assign) uint8_t frequencyLength;

/// 每包采样数据个数 (Number of samples per packet)
@property (nonatomic, assign) uint8_t frequencyCount;

/// 当前包序号，从 1 开始编号 (Current packet index since start, big-endian)
@property (nonatomic, assign) uint32_t packetIndex;

/// 当前秒的时间偏移 (Offset within the current second, milliseconds)
@property (nonatomic, assign) uint32_t packetOffset;

/// 当前秒中的分包序号 (Sub-packet index within the current second)
@property (nonatomic, assign) uint8_t packetIndex_sub;

/// LOVING 点数据数组 (Array of LOVING sample points)
@property (nonatomic, strong) NSArray<BTRtLovingPoint *> *lovingPoints;

/// PPI 点数据数组 (Array of PPI sample points)
@property (nonatomic, strong) NSArray<BTRtPPIPoint *> *ppiPoints;

/**
 *  通过原始数据生成模型实例
 *  Create model instance from raw binary data.
 *
 *  @param contentData 原始二进制数据 (Raw packet data)
 *  @return 解析后的 BTRtPPIModel 对象 (Parsed model object)
 */
+ (instancetype)modelWithData:(NSData *)contentData;

@end

NS_ASSUME_NONNULL_END
