//
//  ECGDumpper.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/11/8.
//

#import <Foundation/Foundation.h>

@interface ECGDumpper : NSObject

// 是否启用数据输出开关
@property (nonatomic, assign) BOOL isDumpEnabled;

// 单例实例
+ (instancetype)sharedInstance;

// 写入实时数据 - 源数据（处理前）
- (void)dumpRTSourcePacket:(BTECGPacket *)sourcePacket;

// 写入实时数据 - 处理后数据
- (void)dumpRTProcessedPacket:(BTECGPacket *)processedPacket;

// 写入最终数据 - 源数据（处理前），传入多个包
- (void)dumpFinalSourcePackets:(NSArray<BTECGPacket *> *)sourcePackets;

// 写入最终数据 - 处理后数据，传入多个包
- (void)dumpFinalProcessedPackets:(NSArray<BTECGPacket *> *)processedPackets;

// 写入分析结果
- (void)dumpFinalResultWithData:(NSArray<NSArray<NSNumber *> *> *)diagnosisResults
                       rawData:(NSArray<NSNumber *> *)rawData
                             fs:(double)fs;

// 重置所有文件并清空内容
- (void)reset;

@end
