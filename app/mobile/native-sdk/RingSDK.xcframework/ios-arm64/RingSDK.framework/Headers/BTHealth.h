//
//  BTHealth.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/29.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTHealthModel.h>

NS_ASSUME_NONNULL_BEGIN

/**
 管理和获取健康数据。
 Manages and retrieves health data.
 */
@interface BTHealth : NSObject

/// 存储健康数据记录。
/// Stores health data records.
@property (nonatomic, strong) NSMutableArray<BTHealthModel *> *healthDataRecords;

/**
 启动健康数据收集。如果有正在进行的请求则返回 NO。
 Initiates health data collection. Returns NO if there is an ongoing request.

 @param dateComponents 指定数据日期。Specifies the date for data.
 @param completionHandler 返回数据数组。Returns data array.
 @return BOOL 如果存在正在进行的请求，返回 NO，否则尝试收集数据并返回 YES。
 @discussion YES 表示成功发送指令，NO 表示重复发送或发送失败。
 */
- (BOOL)fetchHealthDataWithDateComponents:(NSDateComponents *)dateComponents
                                completion:(void (^)(NSArray<BTHealthModel *> *data))completionHandler;

@end

NS_ASSUME_NONNULL_END
