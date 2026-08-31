//
//  ECGFilter.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/9/29.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/*
流程备注：

1. 初始化：
    - 创建 ECGFilter 单例。
    - 通过 SMEcgSdk 注册心电分析服务。
    - 根据是否启用中间处理模式（isMidProcessingEnabled）设置数据处理阈值。

2. 包接收：
    - 接收每个心电包（BTECGPacket），检查包号是否是预期包。
    - 若是预期包，添加到缓存区并更新心电数据。
    - 若非预期包，加入乱序缓冲区。

3. 乱序包处理：
    - 检查乱序包缓冲区中是否有期望包，处理并插入主缓存。
    
4. 实时处理：
    - 若开启中间处理模式（V2），达到阈值时，使用 SMEcgSdk 实时处理缓存的心电包数据，并调用回调函数返回处理后的数据。
    - 若未开启中间处理模式（V1），则直接返回原始的心电包数据，不进行处理。

5. 诊断分析（最终处理）：
    - V2 模式下，调用 SMEcgSdk 的诊断功能进行心电数据分析，返回处理后的数据及诊断结果。
    - V1 模式下，直接返回原始心电包数据，不进行任何分析处理。

6. 缓存清理：
    - 清空所有缓存的包数据和心电数据，重置包号、阈值等状态。
*/

@interface ECGFilter : NSObject

/// 单例方法
+ (instancetype)sharedInstance;

/// 接收 packet 的接口
/// - Parameter packet: 需要接收的 ECG 数据包
- (void)receivePacket:(BTECGPacket *)packet;

/// 返回实时处理后的 packets
/// - Parameter completion: 处理完毕后返回的 packets 回调
- (void)setOnRealtimeProcessed:(void (^)(NSArray<BTECGPacket *> *processedPackets))completion;

/// 处理完所有 packets 后的最终返回接口
/// - Parameter completion: 回调函数，返回两个参数
///   - allPkts: 处理后的所有 BTECGPacket 数据数组
///   - diagnosisResult: 诊断结果，包含以下内容:
///     - processedECGData: 处理后的心电数据 (NSArray<NSNumber *>)
///     - heartRateInfo: 心率相关信息 (NSArray<NSNumber *>), 包括 minHR, meanHR, maxHR 等
///     - rhythmInfo: 心律(节律)相关信息 (NSArray<NSNumber *>), 包括 TypeIndex 和 置信度
- (void)onFinalProcessed:(void (^)(NSArray<BTECGPacket *> *allPkts, NSDictionary *diagnosisResult))completion;

/// 清空缓存数据
- (void)clearBuffer;

@property (nonatomic,strong)NSString *key;

- (void)setEcgKey:(NSString *)ecgKey;

@end

NS_ASSUME_NONNULL_END
