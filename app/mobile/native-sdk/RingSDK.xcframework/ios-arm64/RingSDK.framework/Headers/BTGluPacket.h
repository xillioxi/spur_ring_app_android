//
//  BTGluPacket.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/8/28.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTGluValue.H>

NS_ASSUME_NONNULL_BEGIN
/// 血糖数据模型类
/// Model class for blood glucose data
@interface BTGluPacket : NSObject

/// 血糖测量时间，6字节（年-月-日-时-分-秒）
/// Blood glucose measurement time, 6 bytes (YY-MM-DD-HH-MM-SS)
@property (nonatomic, assign) NSTimeInterval startInterval;

/// 原始测量时间数据，用于ACK回执
/// Raw measurement time data, used for ACK
@property (nonatomic, strong) NSData *dateData;

/// 采样率，2字节，U16，单位为Hz
/// Sample rate, 2 bytes, U16, in Hz
@property (nonatomic, assign) uint16_t sampleRate;

/// 当前包序号，2字节，U16
/// Current packet number, 2 bytes, U16
@property (nonatomic, assign) uint16_t currentPktNum;

/// 每包血糖数据个数，1字节，U8
/// Number of blood glucose data per packet, 1 byte, U8
@property (nonatomic, assign) uint8_t dataNumInPkt;

/// 单个血糖数据长度，1字节，U8
/// Length of a single blood glucose data, 1 byte, U8
@property (nonatomic, assign) uint8_t gluDataLength;

///血糖测量模式0x00或0xFF默认为0x01模式  0x02：ppg nbit = 16，0x03:ppg nbit = 24， 0x04:ppg nbit = 24，
@property (nonatomic, assign) uint8_t gluDataModel;

/// 血糖数据数组，元素长度由 gluDataLength 决定
/// Blood glucose data array, element length determined by gluDataLength
@property (nonatomic, strong) NSArray<BTGluValue *> *gluData;

/// 使用原始字节数据初始化模型
/// Initialize model with raw byte data
/// @param data 包含血糖数据的原始字节
/// @param isAsync 是否异步解析
/// @param completion 数据解析完成回调
- (void)parseWithBytes:(NSData *)data isAsync:(BOOL)isAsync completion:(void (^)(void))completion;

/// 将 BTGluPacket 数组编码为 JSON 格式的字典。
/// 该方法会在后台线程中执行，处理完成后通过回调返回结果。
/// @param packets 包含多个 BTGluPacket 的数组，其中每个 BTGluPacket 包含多个 BTGluValue 数据项。
/// @param fasting 表示是否空腹状态，YES 表示空腹，NO 表示非空腹。
/// @param within2HrsMeal 表示是否在进餐后两小时内，YES 表示在两小时内，NO 表示不在两小时内。
/// @param completion 处理完成后的回调，返回包含血糖数据及其时间戳的 JSON 格式字典。
/// 回调将在主线程中执行。
+ (void)packageGLUValues:(NSArray<BTGluPacket *> *)packets
                fasting:(BOOL)fasting
        within2HrsMeal:(BOOL)within2HrsMeal
             completion:(void (^)(NSDictionary *result))completion;
@end

NS_ASSUME_NONNULL_END
