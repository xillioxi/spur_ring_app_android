//
//  BTSport.h
//  RingSDK
//
//  Created by Kaoji on 2024/05/29.
//

#import <Foundation/Foundation.h>
#import <RingSDK/RingDef.h>
#import <RingSDK/BTSportStatus.h>
#import <RingSDK/BTSportRealTimeModel.h>
#import <RingSDK/BTSportSummaryModel.h>
#import <RingSDK/BTSportDetailModel.h>

NS_ASSUME_NONNULL_BEGIN

/// 设备运动控制类。Manages device sports features.
@interface BTSport : NSObject

/// 生成一个用于标识具体运动会话的ID。Generates an identifier for a specific sport session.
/// @return 返回一个包含运动会话标识的NSData对象。Returns an NSData object containing the sport session identifier.
+ (NSData *)generateSportId;

/// 根据时间戳生成运动ID数据, 即开始时间。Generates sport ID data from a timestamp.
/// @param timestamp Unix时间戳。Unix timestamp.
/// @return 返回包含运动ID的数据。Returns data containing the sport ID.
+ (NSData *)stampToSportID:(NSInteger)timestamp;

/// 根据数据解析运动ID或运动日期。
/// Parses the sport ID or sport date from data.
/// @param data 包含运动ID的数据。Data containing the sport ID.
/// @param isZeroHour 是否将时间设置为零点。Whether to set the time to zero-hour.
/// @return 返回解析出的运动ID时间戳。Returns the parsed sport ID as a Unix timestamp.
+ (NSInteger)parseSportIDWithData:(NSData *)data isZeroHour:(BOOL)isZeroHour;

/// 执行运动操作。Executes sport operations.
/// @param operationType 操作类型。Type of operation.
/// @param sportType 运动类型。Type of sport.
/// @param sportID 会话标识。Session identifier.
/// @param completion 完成回调。Completion callback.
/// @discussion YES表示发送成功，NO表示重复发送或发送失败。YES indicates success, NO indicates duplicate or failure.
/// 
/**
 * BTSportOperationType 回调枚举对应关系
 *
 * 查询运动状态 query sport status:
 * - 0x9620:
 *   - 0x00: BTSportStatusTypeNoSport - 无运动且无数据上传
 *   - 0x01: BTSportStatusTypeActive - 运动中
 *   - 0x02: BTSportStatusTypePaused - 暂停
 *   - 0x03: BTSportStatusTypeUnsynced - 未同步数据
 *
 * BTSportOperationTypeStart:
 * - 0x9621:
 *   - 0x00: BTSportStatusTypeStartFailed - 开始失败
 *   - 0x01: BTSportStatusTypeStarted - 开始成功
 *   - 0x02: BTSportStatusTypeActive - 已在运动中
 *   - 0x03: BTSportStatusTypeUploadingData - 数据上传中
 *
 * BTSportOperationTypePause:
 * - 0x9622:
 *   - 0x01: BTSportStatusTypePaused - 暂停成功
 *   - 0x02: BTSportStatusTypePauseFailed - 暂停失败
 *   - 0x03: BTSportStatusTypeStopped - 运动已停止
 *
 * BTSportOperationTypeResum:
 * - 0x9623:
 *   - 0x01: BTSportStatusTypeResumed - 继续成功
 *   - 0x02: BTSportStatusTypeResumeFailed - 继续失败
 *   - 0x03: BTSportStatusTypeStopped - 运动已停止
 *
 * BTSportOperationTypeStop:
 * - 0x9624:
 *   - 0x01: BTSportStatusTypeStopped - 停止成功
 *   - 其他: BTSportStatusTypeStopFailed - 停止失败
 */
-(BOOL)executeOperation:(BTSportOperationType)operationType
          SportWithType:(BTSportType)sportType
                sportID:(NSData *)sportID
             completion:(void (^)(BTSportStatus * _Nullable status))completion;

/// 查询设备是否有正在进行的运动。Queries the device for ongoing sport activities.
/// @param completion 完成回调。Completion block returning the sport status.
/// @discussion YES表示发送成功，NO表示重复发送或发送失败。YES indicates success, NO indicates duplicate or failure.
-(BOOL)queryOngoingSportWithCompletion:(void (^)(BTSportStatus * _Nullable status))completion;

/// 放弃当前运动并删除相关数据。
/// Abandons the current sport session and deletes its related data.
/// @param sportID 运动会话标识，用来指定要放弃的运动。The identifier of the sport session to be abandoned.
/// @param completion 完成回调，通过此回调返回操作结果。Completion handler that returns the result of the operation.
/// @discussion 此方法尝试放弃指定的运动会话。如果成功，completion 回调的 success 参数为 YES，否则为 NO。
/// @note 调用此方法后，如果放弃操作成功，与该运动会话相关的所有数据将被删除。After calling this method, if the abandon operation is successful, all data related to the sport session will be deleted.
- (BOOL)abandonSportWithSportID:(NSData *)sportID completion:(void (^)(BOOL success, NSData *sportID))completion;

/// 请求当前运动的实时数据。
/// Requests real-time data for the current sport.
/// @param sportID 会话标识符。
/// @param completion 完成回调，返回运动实时状态。
/// @discussion 请求成功返回YES，失败或重复请求返回NO。
-(BOOL)requestRealTimeDataForSport:(NSData *)sportID
                        completion:(void (^)(BTSportRealTimeModel * _Nullable liveData))completion;

 /// 请求综合运动数据。
 /// Retrieves comprehensive sport data.
 /// @param sportID 会话标识符。The session identifier for the sport.
 /// @param completion 完成回调，返回运动综合数据状态。A completion block that returns the sport's comprehensive data status.
 /// @discussion 请求成功发起返回YES，请求失败或重复请求返回NO。Returns YES if the request is successfully initiated, NO if the request fails or is a duplicate.

-(BOOL)requestSportSummary:(NSData *)sportID
                        completion:(void (^)(BTSportSummaryModel * _Nullable summary))completion;

/// 请求特定运动的详细数据。
/// Requests detailed data for a specific sport.
/// @param sportID 会话标识符。The session identifier for the sport.
/// @param completion 完成回调，返回详细运动数据数组。A completion block that returns an array of detailed sport data.
/// @discussion 请求成功发起返回YES，如果参数无效、请求失败或重复请求返回NO。Returns YES if the request is successfully initiated, NO if the parameters are invalid, the request fails, or is a duplicate.
- (BOOL)requestSportDetail:(NSData *)sportID
                completion:(void (^)(NSArray<BTSportDetailModel *> * _Nullable details))completion;
@end

NS_ASSUME_NONNULL_END

