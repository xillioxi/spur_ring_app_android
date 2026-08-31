//
//  ECGData.h
//  AIZOSDK
//
//  Created by kaoji on 9/24/23.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTECGValue.h>

NS_ASSUME_NONNULL_BEGIN

/// 用于表示ECG数据的模型类
@interface BTECGPacket : NSObject

/// ECG测量时间（6字节，每个字节为U8，年月日时分秒）
/// 6字节分别为年月日时分秒，年需减去2000
@property (nonatomic, assign) NSTimeInterval startInterval;
// 原始测量时间数据
// ACK Back 需要用到
@property (nonatomic, strong) NSData *dateData;

/// 采样率（2字节，U16，单位为Hz）
@property (nonatomic, assign) uint16_t sampleRate;

/// 当前分包序号（2字节，U16，从1开始编号）
@property (nonatomic, assign) uint16_t currentPktNum;

/// 每包ECG数据个数（1字节，U8）
@property (nonatomic, assign) uint8_t dataNumInPkt;

/// 单个ECG数据长度（1字节，U8）
@property (nonatomic, assign) uint8_t ecgDataLength;

/// ECG数据（动态数组，每个元素的长度由ecgDataLength确定）
@property (nonatomic, strong) NSArray<BTECGValue *> *ecgData;

/// 使用原始字节初始化模型
/// @param data 包含ECG数据的原始字节
/// @param isAsync 是否异步解释
/// @param completion 数据解释完成回调回调
- (void)parseWithBytes:(NSData *)data isAsync:(BOOL)isAsync completion:(void (^)(void))completion;

@end


NS_ASSUME_NONNULL_END
