//
//  BTAudioPacketDBManager.h
//  RingSDK
//
//  Created by 黄建华 on 2025/11/10.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTAudioPacketDBManager : NSObject

//MARK: - 插入或更新音频分包数据（线程安全）
/// @param model 要保存的 BTAudioPacketModel 对象
/// @return 成功返回 YES，失败返回 NO
+ (BOOL)saveOrUpdatePacket:(BTAudioPacketModel *)model;

//MARK: - 查询所有音频分包
+ (NSArray<BTAudioPacketModel *> *)queryAllPackets;


//MARK: -删除指定数据
/// @param packedTime 数据包时间戳
/// @param packetIndex 数据包索引
/// @return 是否删除成功
+ (BOOL)deletePacketWithPackedTime:(UInt64)packedTime packetIndex:(UInt32)packetIndex;

//MARK: - 删除所有数据
+ (BOOL)deleteAllPackets;

//MARK: -根据文件序号查询所有音频分包
+ (NSArray<BTAudioPacketModel *> *)queryAllPacketsWithPackedTime:(UInt64)packedTime;

+ (void)generateMockPackets;

//MARK: -根据文件序号生成文件路径
+ (nullable NSString *)makeAudioFileWithPackedTime:(UInt64)packedTime;

//MARK: -返回最后一个包
+ (nullable BTAudioPacketModel *)queryLatestPacket;

//MARK: - 将裸流opus 转成ogg~格式
+ (void)convertOpusToOggDefaultPath:(NSString *)inputPath
                    completion:(void(^)(BOOL success, NSString *outputPath, NSString *errorMsg))completion;

//MARK: -根据ID 查询最后一个包
+ (nullable BTAudioPacketModel *)queryLastPacketWithPackedTime:(UInt64)packedTime;

@end

NS_ASSUME_NONNULL_END
