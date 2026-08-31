//
//  BTZoneHelp.h
//  RingSDK
//
//  Created by 黄建华 on 2026/1/17.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(uint8_t, BTNoticeType) {
    BTNoticeTypeUnknown = 0x00,  ///< 未知，缺省值
    BTNoticeTypeApp = 0x01,      ///< 我司自研或定制APP
    BTNoticeTypeSdkApp = 0x02    ///< 客户基于SDK自行开发的APP
};

@interface BTZoneHelp : NSObject

+ (BTCareHelp *)shared;

/// 返回当前设备的 3030 协议时区字段字节（有符号1byte）
/// 每单位15分钟，范围 -48 ~ 56
- (int8_t)currentTimezoneByte;

/// 设置通知类型
/// @param type 通知类型，取值含义如下：
///             BTNoticeTypeUnknown (0x00) - 未知，缺省值
///             BTNoticeTypeApp (0x01) - 我司自研或定制APP
///             BTNoticeTypeSdkApp (0x02) - 客户基于SDK自行开发的APP
/// @param completion 设置完成回调，返回是否成功
- (void)setNoticeType:(BTNoticeType)type
           completion:(void (^)(BOOL success))completion;

@end

NS_ASSUME_NONNULL_END
