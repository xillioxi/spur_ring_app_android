//
//  BTAudioManager.h
//  RingSDK
//
//  Created by 黄建华 on 2025/11/6.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN


typedef NS_ENUM(NSInteger, BLEFilesType) {
    BLEFilesTypeRecord = 1,         // 录音功能
    BLEFilesTypeOther = 2
};

//下载文件枚举
typedef NS_ENUM(NSInteger, BLEReceiveStatus) {
    BLEReceiveStatusStart = 1,         // 开始接收 可能文件可能有 单个 多个
    BLEReceiveStatusFailed = 2,        // 接收失败 某一次的请求失败或者堵塞
    BLEReceiveStatusSingleSuccess = 3, // 某个录音文件接收成功
    BLEReceiveStatusAllSuccess = 4,    // 所有录音文件接收成功,同步结束
    BLEReceiveStatusEnpty = 5 ,         // 没有录音文件 如果没有文件//或者文件错误
    BLEReceiveStatusUploading = 6       // 当前某个文件同步中
};

//全局监听枚举
typedef NS_ENUM(uint8_t, AudioRecordStatus) {
    AudioRecordStatusUnkonw      = 0x00,  //  未知状态
    AudioRecordStatusIdle        = 0x01, // 开始录音
    AudioRecordStatusRecording   = 0x02, // 录音中
    AudioRecordStatusPaused      = 0x03, // 暂停中（暂不使用）
    AudioRecordStatusDataPending = 0x04, // 停止录音
    AudioRecordStatusUploading   = 0x05  // 数据上传中

};

// 只代表发送成功 详细要监听receiveFileCompletion这个回调/有枚举说明
typedef void(^BLECompletionBlock)(BOOL status);
//MARK: -用来开启接受文件 可能会有多次回调因为是循环请求的 SDK里面如果有多文件的话
typedef void(^BLEFileReceiveFileCompletion)(BLEReceiveStatus status);
//MARK: -文件接收进度回调（带包数 / 文件数）
typedef void(^BLEFileReceiveProgressBlock)(
    BLEReceiveStatus status,
    NSInteger currentPacket,     // 当前第几包
    NSInteger totalPackets,       // 当前文件总包数
    NSInteger currentFileIndex,   // 当前第几个文件
    NSInteger totalFiles          // 总文件数
);
//MARK: -日志回调
typedef void(^BTLogHandler)(NSString *message);
//MARK: -全局的监听
typedef void(^AudioRecordStatusCompletion)(AudioRecordStatus status,NSInteger time);

typedef void(^RecordParamsCallback)(uint16_t bitrate, uint8_t volume, NSArray<NSString *> *extraInfo);

typedef void(^RecordParamsCallbackLight)(uint16_t bitrate, uint8_t volume,uint8_t light, NSArray<NSString *> *extraInfo);

@interface BTAudioManager : NSObject

@property (nonatomic, copy, nullable) BTLogHandler logHandler;

//MARK: -用来监听某个文件录音成功回调
@property (nonatomic, copy, nullable) BLEFileReceiveFileCompletion receiveFileCompletion;
//MARK: -文件接收进度回调（更详细）
@property (nonatomic, copy, nullable) BLEFileReceiveProgressBlock receiveFileProgressBlock;
//MARK: -全局的监听 连接上会回调 中途状态详见枚举说明~
@property (nonatomic, copy, nullable) AudioRecordStatusCompletion audioRecordStatusBlock;

+ (instancetype)sharedInstance;

//MARK: -录音过程中回调状态描述 增加剩余工作时长 单位秒:如果是-1为工作或录音中 空闲才能获取正确的
+ (NSString *)descriptionForReceiveStatus:(BLEReceiveStatus)status;
//MARK: -开始下载录音文件
- (void)fetchLargeAudioFile:(BLECompletionBlock)completion;

//MARK: -日志
- (void)logMessage:(NSString *)message;

/// 获取设备当前录音参数（异步返回）
/// @param completion 回调：bitrate(录音码率 kbps6~510) + volume(音量 1~32)
- (BOOL)getCurrentRecordParamsWithCompletion:(RecordParamsCallbackLight)completion;

/// 设置设备录音参数（异步回调成功/失败）
/// @param bitrate 录音码率：6~510 kbps 整数
/// @param volume 录音音量等级：1~32
/// @param completion 回调：YES=成功，NO=失败
- (BOOL)setRecordParamsWithBitrate:(uint16_t)bitrate
                            volume:(uint8_t)volume
                            light:(uint8_t)light
                        completion:(BLECompletionBlock)completion;

//MARK: -设备向APP上报当前工作状态
- (void)processUncauchCommand:(NSData *)contentData;


//MARK: - APP向设备查询当前存储状态
/**
 @param type 查询的文件类型
        0x01 - 录音文件
        其他 - 暂未定义

 @param completion 查询结果回调
        type       文件类型（与请求的类型一致）
        fileCount  文件数量（U16，大端序）
        totalSize  数据总字节数（U32，大端序）

 协议返回数据结构：
 ┌──────────────┬────────────┬──────────────┐
 │ 字段          │ 字节数      │ 说明          │
 ├──────────────┼────────────┼──────────────┤
 │ type         │ 1 byte     │ 文件类型       │
 │ fileCount    │ 2 byte     │ 文件数量(U16)  │
 │ totalSize    │ 4 byte     │ 数据字节数(U32)│
 └──────────────┴────────────┴──────────────┘
 */
- (void)queryDeviceStorageStatus:(BLEFilesType)type
                      completion:(void (^)(BLEFilesType type,
                                           uint16_t fileCount,
                                           uint32_t totalSize))completion;


@end

NS_ASSUME_NONNULL_END
