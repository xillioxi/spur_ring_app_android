//
//  BTScoreAlgorithm.h
//  RingSDK
//
//  Created by Kaoji on 2024/6/17.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTHealthScore.h>

/// 健康综合评分 / Comprehensive Health Score
@interface BTScoreAlgorithm : NSObject

/**
 * 计算健康得分 / Calculate the health score
 *
 * @param timestamp 日期时间戳，该天0点0分0秒的时间戳 / Timestamp of the day at 00:00:00
 * @param sleepData 该天以及之前7天的夜间睡眠数据 / Sleep data for the day and the previous 7 nights
 * @param healthData 该天以及之前7天的日常健康数据 / Daily health data for the day and the previous 7 days
 * @param sportData 该天以及之前7天的运动锻炼数据 / Exercise data for the day and the previous 7 days
 * @param healthScore 之前7天的健康评分数据 / Health score data for the previous 7 days
 * @return 返回当天的健康评分对象 BTHealthScore / Returns the health score object for the day BTHealthScore
 */
- (BTHealthScore *)calculateHealthScoreWithDate:(NSUInteger)timestamp
                                      sleepData:(NSMutableArray<BTSleepSummaryModel *> *)sleepData
                                     healthData:(NSMutableArray<BTHealthModel *> *)healthData
                                      sportData:(NSMutableArray<BTSportSummaryModel *> *)sportData
                                    healthScore:(NSMutableArray<BTHealthScore *> *)healthScore;


/**
 * 异步计算健康得分并通过闭包回调 / Asynchronously calculate the health score and return via callback
 *
 * @param timestamp 日期时间戳，该天0点0分0秒的时间戳 / Timestamp of the day at 00:00:00
 * @param sleepData 该天以及之前7天的夜间睡眠数据 / Sleep data for the day and the previous 7 nights
 * @param healthData 该天以及之前7天的日常健康数据 / Daily health data for the day and the previous 7 days
 * @param sportData 该天以及之前7天的运动锻炼数据 / Exercise data for the day and the previous 7 days
 * @param healthScore 之前7天的健康评分数据 / Health score data for the previous 7 days
 * @param completion 回调闭包，返回当天的健康评分对象 BTHealthScore / Completion block that returns the health score object for the day BTHealthScore
 */
- (void)calculateHealthScoreWithDate:(NSUInteger)timestamp
                           sleepData:(NSMutableArray<BTSleepSummaryModel *> *)sleepData
                          healthData:(NSMutableArray<BTHealthModel *> *)healthData
                           sportData:(NSMutableArray<BTSportSummaryModel *> *)sportData
                         healthScore:(NSMutableArray<BTHealthScore *> *)healthScore
                          completion:(void (^)(BTHealthScore *healthScore))completion;

@end
