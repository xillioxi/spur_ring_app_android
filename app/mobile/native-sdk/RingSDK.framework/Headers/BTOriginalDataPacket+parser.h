//
//  BTOriginalDataPacket+parser.h
//  RingSDK
//
//  Created by Kaoji on 2024/12/12.
//

#import <RingSDK/RingSDK.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTOriginalDataPacket (parser)

//情绪
/// 解析数据包并返回结果数组，每个元素代表一次测量数据
/// @param packets 数据包数组
/// @return 结果数组，每个元素包含一次测量的数据（startTime 和 data 数组）
- (NSArray *)parsePpiDataToResultArrayFromPackets:(NSArray<BTOriginalDataPacket *> *)packets;

//睡眠详情
- (NSArray *)parseSleepDataToResultArrayFromPackets:(NSArray<BTOriginalDataPacket *> *)packets;

//紫外线
- (NSArray *)parseUVDataToResultArrayFromPackets:(NSArray<BTOriginalDataPacket *> *)packets;

@end

NS_ASSUME_NONNULL_END
