//
//  BTECGEndPacket.h
//  AIZOSDK
//
//  Created by kaoji on 10/9/23.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTECGEndPacket : NSObject
/// ECG测量时间（6字节，每个字节为U8，年月日时分秒）
/// 6字节分别为年月日时分秒，年需减去2000
@property (nonatomic, strong) NSDate *startDate;

// 原始测量时间数据
// ACK Back 需要用到
@property (nonatomic, strong) NSData *dateData;

/// 当前分包序号（2字节，U16，从1开始编号）
@property (nonatomic, assign) uint16_t currentPktNum;
/// 使用原始字节初始化模型
/// @param data 包含ECG数据的原始字节
/// @param isAsync 是否异步解释
/// @param completion 数据解释完成回调回调
- (void)parseWithBytes:(NSData *)data isAsync:(BOOL)isAsync completion:(void (^)(void))completion;
@end

NS_ASSUME_NONNULL_END
