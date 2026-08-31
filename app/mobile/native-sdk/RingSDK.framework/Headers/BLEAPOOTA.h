//
//  BLEAPOOTA.h
//  RingAssist
//
//  Created by 黄建华 on 2026/3/17.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, AMOTASessionStatus) {
    AMOTASessionStatusSuccess = 0,  // OTA 成功完成
    AMOTASessionStatusFailure = -1  // OTA 失败（任何原因）
};

#pragma mark - AMOTA Status Enum

typedef NS_ENUM(NSInteger, eAmotaStatus) {
    AMOTA_STATUS_SUCCESS = 0,              // 成功
    AMOTA_STATUS_CRC_ERROR = 1,            // CRC 校验失败
    AMOTA_STATUS_INVALID_HEADER_INFO = 2,  // 固件头信息错误
    AMOTA_STATUS_INVALID_PKT_LENGTH = 3,   // 数据包长度错误
    AMOTA_STATUS_INSUFFICIENT_BUFFER = 4,  // 缓冲区不足
    AMOTA_STATUS_INSUFFICIENT_FLASH = 5,   // Flash 空间不足
    AMOTA_STATUS_UNKNOWN_ERROR = 6,        // 未知错误
    AMOTA_STATUS_FLASH_WRITE_ERROR = 7,    // 写 Flash 错误
    AMOTA_STATUS_MAX                        // 枚举最大值
};

// 新的回调 typedef
typedef void (^AMOTASessionTypedCompletion)(AMOTASessionStatus status, NSError *_Nullable error);

typedef void (^AMOTASessionProgressBlock)(int progressPercent);
typedef void (^AMOTASessionStatusBlock)(NSString *status);
typedef void (^AMOTASessionCompletionBlock)(NSError *_Nullable error);

typedef void(^BLEAPOOTAProgressBlock)(float progress);
typedef void(^BLEAPOOTACompletionBlock)(BOOL success, NSString * _Nullable error);
typedef void (^AMBLEWriteCompletion)(NSError *_Nullable error);

@interface BLEAPOOTA : NSObject

@property (nonatomic, copy, nullable) AMOTASessionStatusBlock onStatus;

@property (nonatomic, strong) CBPeripheral *peripheral;
@property (nonatomic, strong) CBCharacteristic *writeChar; // 写
@property (nonatomic, strong) CBCharacteristic *notifyChar; // 收

- (void)startOtaWithPeripheral:(CBPeripheral *)peripheral
                            file:(NSString *)filePath
                        progress:(BLEAPOOTAProgressBlock)progressBlock
                    completion:(BLEAPOOTACompletionBlock)completionBlock;

- (void)handleNotifyData:(NSData *)data;

/// 获取单例
+ (instancetype)sharedManager;


- (void)resetApo;

@end

NS_ASSUME_NONNULL_END
