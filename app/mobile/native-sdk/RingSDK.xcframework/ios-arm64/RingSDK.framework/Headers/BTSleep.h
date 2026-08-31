//
//  BTSleep.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/29.
//


#import <Foundation/Foundation.h>
#import <RingSDK/BTSleepDetailModel.h>
#import <RingSDK/BTNapDetailModel.h>
#import <RingSDK/BTSleepSummaryModel.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^FetchSleepCompletionBlock)(BTSleepSummaryModel * _Nullable summary, NSArray<BTSleepDetailModel *> * _Nullable sleepDetails);

@interface BTSleep : NSObject

// Parses raw sleep data. For debugging only.
// 解析原始睡眠数据。仅供调试使用。
- (BTSleepSummaryModel *)parseSleepSummaryFromRawData:(NSData *)data;
- (NSArray<BTSleepDetailModel *> *)parseSleepDetailFromRawData:(NSData *)data;
- (NSArray<BTSleepDetailModel *> *)filterSleepDetailsBeforeShutdown:(NSArray<BTSleepDetailModel *> *)sleepDetails;

///// 获取睡眠详情。如果有正在进行的请求则返回 NO。YES 表示成功发送指令，NO 表示重复发送或发送失败。Fetch sleep details. Returns NO if there is an ongoing request. YES indicates the command was sent successfully, NO indicates a duplicate or failure.
///// @param dateComponents 指定数据日期。Specifies the date for data.
///// @param completion 完成回调，返回睡眠详情。Completion callback, returning sleep details.
//- (BOOL)fetchSleepDetailsWithDateComponents:(NSDateComponents *)dateComponents
//                                 completion:(void (^)(NSArray<BTSleepDetailModel *> * _Nullable details))completion __attribute__((deprecated("This method is deprecated, use fetchSleepWithDateComponents: instead")));
//
///// 获取睡眠综合概况。如果有正在进行的请求则返回 NO。YES 表示成功发送指令，NO 表示重复发送或发送失败。Fetch sleep summary. Returns NO if there is an ongoing request. YES indicates the command was sent successfully, NO indicates a duplicate or failure.
///// @param dateComponents 指定数据日期。Specifies the date for data.
///// @param completion 完成回调，返回睡眠综合概况。Completion callback, returning sleep summary.
//- (BOOL)fetchSummaryWithDateComponents:(NSDateComponents *)dateComponents
//                             completion:(void (^)(NSArray<BTSleepSummaryModel *> * _Nullable summaries))completion __attribute__((deprecated("This method is deprecated, use fetchSleepWithDateComponents: instead")));

/// 计算睡眠综合信息，此方法不包含零星小睡。Calculate the sleep summary from  sleep detail models, excluding naps.
/// @param sleepDetails 包含睡眠模式和时间戳的睡眠细节数据数组。Array of sleep detail models.
/// @return 返回计算得出的睡眠综合模型，如果输入数据为空则返回nil。Returns a calculated sleep summary model, or nil if the input data array is empty.
- (nullable BTSleepSummaryModel *)calculateSleepSummaryFromDetails:(NSArray<BTSleepDetailModel *> *)sleepDetails;

/// 获取睡眠数据。如果有正在进行的请求则返回 NO。YES 表示成功发送指令，NO 表示重复发送或发送失败。Fetch sleep data with date components. Returns NO if there is an ongoing request. YES indicates the command was sent successfully, NO indicates a duplicate or failure.
/// @param dateComponents 指定数据日期。Specifies the date for data.
- (BOOL)fetchSleepWithDateComponents:(NSDateComponents *)dateComponents;

/// 处理睡眠数据的回调函数, 。该函数应全局监听一次即可。Handle the sleep data callback. This method should be globally listened to only once.
/// @param completion 完成回调，返回睡眠综合 睡眠详情。Completion callback, returning sleep summary/details.
- (void)handleSleepData:(FetchSleepCompletionBlock)completion;

@end

NS_ASSUME_NONNULL_END
