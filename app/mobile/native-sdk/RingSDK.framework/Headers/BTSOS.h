//
//  BTSOS.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/30.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTSOSStateModel.h>

NS_ASSUME_NONNULL_BEGIN

/// 设备控制器类，用于管理设备的SOS功能
/// Device controller class for managing the SOS feature of the device
@interface BTSOS : NSObject

/// 获取设备当前SOS状态
/// Fetch the current state of the SOS feature
/// @param completion 完成回调，返回设备的当前SOS状态。Completion callback, returning the current SOS state of the device.
/// @discussion YES表示发送成功，NO表示重复发送或发送失败。
- (BOOL)fetchSOSState:(void (^)(BTSOSStateModel * _Nullable state))completion;

/// 更新设备SOS状态
/// Update the state of the SOS feature
/// @param state 新的SOS状态。The new SOS state.
/// @param completion 完成回调，返回操作是否成功。Completion callback, returning whether the operation was successful.
/// @discussion YES表示发送成功，NO表示重复发送或发送失败。
- (BOOL)updateSOSState:(BTSOSStateModel *)state completion:(void (^)(BOOL success))completion;

/// 请求上传SOS记录
/// Request to upload SOS records
//- (void)requestSOSRecords:(void (^)(NSArray<BTSOSRecordModel *> * _Nullable records))completion;
// SOS记录将通过 sos records redirect to (BTHealth - fetchHealthDataWithDateComponents) 获取

@end

NS_ASSUME_NONNULL_END
