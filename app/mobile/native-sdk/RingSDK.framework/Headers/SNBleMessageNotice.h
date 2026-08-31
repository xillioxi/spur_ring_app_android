//
//  SNBleMessageNotice.h
//  AIZOSDK
//
//  Created by 黄建华 on 2025/4/17.
//

#import <Foundation/Foundation.h>

//NSArray<NSString *> *appPackageNames = @[
//    @"com.tencent.xin",     // 微信
//    @"com.tencent.mobileqq",// QQ
//    @"com.whatsapp"         // WhatsApp
//];

NS_ASSUME_NONNULL_BEGIN

@interface SNBleMessageNotice : NSObject

+ (SNBleMessageNotice *)shared;

//获取支持的应用包名列表
- (NSArray<NSString *> *)getAppPackageNames;

// 设置消息通知
- (void)setNotificationStates:(NSArray<NSString *> *)states
                   completion:(void (^)(BOOL success))completion;

// 获取消息通知包名列表
- (void)getNotificationStatesCompletion:(void (^)(BOOL success,NSArray*list))completion;

@end

NS_ASSUME_NONNULL_END
