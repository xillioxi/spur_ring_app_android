//
//  BTOTAModel.h
//  RingSDK
//
//  Created by Kaoji on 2024/6/7.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// OTAPack 类用于表示一个固件包的详细信息。
/// The OTAPack class represents detailed information about a firmware package.
@interface OTAPack : NSObject

/// 固件更新模式：
/// "0" 表示非强制升级，用户可以选择取消升级。
/// "1" 表示强制升级，用户必须进行升级。
/// The update mode of the firmware:
/// "0" indicates non-mandatory update, allowing the user to cancel the update.
/// "1" indicates mandatory update, requiring the user to perform the update.
@property (nonatomic, copy) NSString *updateMode;

/// 是否显示更新提示。
/// Whether to display the update reminder.
@property (nonatomic, copy) NSString *popupReminder;

/// 固件版本号。
/// The version number of the firmware.
@property (nonatomic, copy) NSString *version;

/// 中文描述。
/// Chinese description.
@property (nonatomic, copy) NSString *descCn;

/// 英文描述。
/// English description.
@property (nonatomic, copy) NSString *descEn;

/// 下载次数。
/// Number of downloads.
@property (nonatomic, assign) NSInteger downloadTimes;

/// 下载链接。
/// Download URL.
@property (nonatomic, copy) NSString *downloadUrl;

/// 设备型号。
/// Device model name.
@property (nonatomic, copy) NSString *modelName;

/// 固件包ID。
/// Firmware package ID.
@property (nonatomic, copy) NSString *packId;

/// 固件包名称。
/// Firmware package name.
@property (nonatomic, copy) NSString *packName;

/// 发布时间。
/// Publish time.
@property (nonatomic, copy) NSString *publishTime;

/// SHA校验值。
/// SHA checksum.
@property (nonatomic, copy) NSString *shaSum;

/// 固件包大小。
/// Firmware package size.
@property (nonatomic, copy) NSString *size;

/// 状态。
/// State.
@property (nonatomic, assign) NSInteger state;

/// 提交时间。
/// Submit time.
@property (nonatomic, copy) NSString *submitTime;

/// 系统平台。
/// System platform.
@property (nonatomic, copy) NSString *sysPlatform;

/// 类型：1-固件包，2-资源包。
/// Type: 1-firmware package, 2-resource package.
@property (nonatomic, assign) NSInteger type;

/// 更新次数。
/// Number of updates.
@property (nonatomic, assign) NSInteger updatedTimes;

/// 更新类型：1-完整升级包，2-差分升级包。
/// Update type: 1-full update package, 2-delta update package.
@property (nonatomic, assign) NSInteger updateType;

/// 将 OTAPack 对象转换为 JSON 字符串。
/// Converts the OTAPack object to a JSON string.
- (NSString *)toJSONString;

@end

/// OTAVersion 类用于表示固件的整体版本信息。
/// The OTAVersion class represents the overall version information of the firmware.
@interface OTAVersion : NSObject

/// 表示是否有新的固件包。
/// Indicates whether there are new firmware packages.
@property (nonatomic, assign) BOOL newOTAPackNum;

/// 包含多个固件包的数组。
/// An array containing multiple firmware packages.
@property (nonatomic, strong) NSArray<OTAPack *> *otapacks;

/// 使用字典初始化固件版本信息。
/// Initializes the firmware version information with a dictionary.
/// @param dictionary 用于初始化固件版本信息的字典。The dictionary used to initialize the firmware version information.
- (instancetype)initWithDictionary:(NSDictionary *)dictionary;

/// 将 OTAVersion 对象转换为 JSON 字符串。
/// Converts the OTAVersion object to a JSON string.
- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
