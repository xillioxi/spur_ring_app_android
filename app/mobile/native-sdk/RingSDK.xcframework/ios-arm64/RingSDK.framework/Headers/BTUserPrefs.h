//
//  BTUserPrefs.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/27.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// 用户偏好设置类
// User Preferences Class
@interface BTUserPrefs : NSObject

// 心率间隔
// Heart Rate Interval
@property (nonatomic, assign) UInt8 heartRateInterval;

// 身高
// Height
@property (nonatomic, assign) UInt8 height;

// 体重
// Weight
@property (nonatomic, assign) UInt8 weight;

// 性别：0x01 代表男性，0x02 代表女性
// Gender: 0x01 for male, 0x02 for female
@property (nonatomic, assign) UInt8 gender;

// 年龄
// Age
@property (nonatomic, assign) UInt8 age;

// 转换为发送数据
// Convert to sendable data
-(NSData *)toSendData;

// 弹窗检查配置(调试)
// alert to check config(Debug)
-(void)showPrefsAlert;

// 保存数据weight和height到NSUserDefaults
// Save weight&height preferences to NSUserDefaults
- (void)savePreferences;

// 读取缓存的身高
// Read cached height from NSUserDefaults
+ (int)readCacheHeight;

// 读取缓存的体重
// Read cached weight from NSUserDefaults
+ (float)readCacheWeight;

// 读取缓存的年龄
// Read cached age from NSUserDefaults
+ (int)readCacheAge;

@end

NS_ASSUME_NONNULL_END
