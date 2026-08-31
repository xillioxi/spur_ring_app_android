//
//  BTCareHelp.h
//  RingSDK
//
//  Created by 黄建华 on 2025/12/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTCareHelp : NSObject

+ (BTCareHelp *)shared;

- (void)setCareReminder:(BTCareDataModel *)reminder
             completion:(void (^)(BOOL success))completion;

//// 
//- (void)deleteAllCareReminderWithCompletion:(void (^)(BOOL success))completion;

@end

NS_ASSUME_NONNULL_END
