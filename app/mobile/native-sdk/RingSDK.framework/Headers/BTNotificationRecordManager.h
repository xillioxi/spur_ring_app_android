//
//  BTNotificationRecordManager.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/11/13.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTNotificationRecord.h>

NS_ASSUME_NONNULL_BEGIN

/// 提醒记录管理器。Notification record manager.
@interface BTNotificationRecordManager : NSObject

/// 请求上传提醒记录。Request to upload notification records.
/// @param completion 请求完成的回调，返回请求是否成功。Completion block with request success status.
/// @return 返回值表示请求是否成功发送。Return value indicates whether the request was successfully sent.
- (BOOL)requestUploadNotificationRecords:(void (^)(BOOL success))completion;

/// 解析上传的提醒记录。Parse uploaded notification records.
/// @param data 提醒记录数据包。Notification record data packet.
/// @return 解析后的提醒记录数组。Parsed array of notification records.
- (NSArray<BTNotificationRecord *> *)parseNotificationRecords:(NSData *)data;

/// 确认收到提醒记录包。Acknowledge receipt of a notification record packet.
/// @param packetIndex 分包编号。Packet index.
/// @param completion 回调是否成功。Completion block with acknowledgment success status.
/// @return 返回值表示请求是否成功发送。Return value indicates whether the acknowledgment request was successfully sent.
- (BOOL)acknowledgeNotificationPacket:(Byte)packetIndex completion:(void (^)(BOOL success))completion;

/// 确认提醒记录上传结束。Confirm the end of notification record upload.
/// @param success 接收结果（`YES` 表示接收成功，`NO` 表示接收失败）。Receive result (`YES` for success, `NO` for failure).
/// @param completion 回调确认结果。Completion block with confirmation success status.
/// @return 返回值表示请求是否成功发送。Return value indicates whether the confirmation request was successfully sent.
- (BOOL)confirmNotificationUploadEnd:(BOOL)success completion:(void (^)(BOOL success))completion;

@end

NS_ASSUME_NONNULL_END
