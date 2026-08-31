//
//  BTCareDataModel.h
//  RingSDK
//
//  Created by 黄建华 on 2025/12/23.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#pragma mark - 枚举定义

/// 提醒类型
typedef NS_ENUM(uint8_t, ReminderTypeSet) {
    ReminderTypeSetBirthDay    = 0x01, // 生日
    ReminderTypeSetAnniversary = 0x02, // 纪念日
    ReminderTypeSetMedication  = 0x11, // 服药
    ReminderTypeSetPeroid      = 0xA1  // 日程
};

/// 设置操作类型
typedef NS_ENUM(uint8_t, ReminderAction) {
    ReminderActionDeleteAll = 0x00, // 删除所有提醒
    ReminderActionAdd       = 0x01, // 增加（相同序号覆盖/更新）
    ReminderActionModify    = 0x03, // 修改
    ReminderActionDelete    = 0x02  // 删除
};

#pragma mark - 结构体定义

/// 单个提醒时间
typedef struct {
    UInt8 hour;   // 时：0–23，不设置置为0xFF
    UInt8 minute; // 分：0–59，不设置置为0xFF
} RemindTime;

#pragma mark - 基类

@interface BTCareDataModel : NSObject

@property (nonatomic, assign) ReminderAction action; // 设置操作
@property (nonatomic, assign) ReminderTypeSet type;  // 提醒类型
@property (nonatomic, assign) NSInteger remindId;    // 提醒ID，建议1–10(全部类型加起来最多10个提醒)

/// 初始化方法
- (instancetype)initWithDictionary:(NSDictionary *)dict;
+ (instancetype)modelWithDictionary:(NSDictionary *)dict;
+ (instancetype)modelWithJsonString:(NSString *)jsonString;

/// 子类必须实现
- (NSDictionary *)toDictionary;
/// 父类统一实现
- (NSString *)toJsonString;
- (NSData *)toData;

- (NSValue *)remindTimeWithHour:(UInt8)hour minute:(UInt8)minute;
- (RemindTime)remindTimeFromValue:(NSValue *)value;

@end

#pragma mark - BirthdayReminderModel（生日子类/纪念日）

@interface BirthdayReminderModel : BTCareDataModel

@property (nonatomic, assign) NSInteger repeatType; // 重复方式，0x00-不重复 按类型定死
@property (nonatomic, assign) NSInteger repeatRule; // 重复规则：提前x天提醒，0表示当天提醒 建议0~7天

@property (nonatomic, assign) UInt16 year;   // 年，不设置置为0xFFFF
@property (nonatomic, assign) UInt8 month;   // 月：1–12，不设置置为0xFF
@property (nonatomic, assign) UInt8 day;     // 日：1–31，不设置置为0xFF

@property (nonatomic, strong) NSValue *remindTimeValue; // 单个时间段

//MARK: - 数据拼接
- (NSData *)toDeviceData;

@end

#pragma mark - MedicationReminderModel（服药子类）

@interface MedicationReminderModel : BTCareDataModel

@property (nonatomic, assign) NSInteger repeatType; // 重复方式，0x04-按天间隔重复 按类型定死
@property (nonatomic, assign) NSInteger repeatRule; // 重复规则：每x天提醒一次，最多31天 默认是1天 

@property (nonatomic, assign) UInt16 year; // 年，不设置置为0xFFFF
@property (nonatomic, assign) UInt8 month; // 月：1–12，不设置置为0xFF
@property (nonatomic, assign) UInt8 day;   // 日：1–31，不设置置为0xFF

@property (nonatomic, strong) NSMutableArray<NSValue *> *remindTimes; // 最多5个时间段

//MARK: - 数据拼接
- (NSData *)toDeviceData;
//MARK: -可以自行组装remindTimes 下面只是辅助
// MARK: - Set or Update RemindTime at specific index / 设置或修改指定索引的提醒时间 index 0~4最多5个 初始化都是0XFF,0XFF
- (BOOL)setRemindTimeAtIndex:(NSUInteger)index hour:(UInt8)hour minute:(UInt8)minute;
// MARK: - Reset all remind times to default / 重置所有提醒时间为默认值
- (void)resetRemindTimes;

@end

#pragma mark - ScheduleReminderModel（日程子类）

@interface ScheduleReminderModel : BTCareDataModel

@property (nonatomic, assign) NSInteger repeatType; // 0x00-不重复，0x03-按周重复，0x04-按天间隔重复，0x05-按小时间隔重复
@property (nonatomic, assign) NSInteger repeatRule;
/*
 规则说明：  0(最高位固定0)日六五四三二一  对应010 11111
 1) 按周重复时：最低位表示周一到周日，010 11111表示周一到周五和周日开启，周六关闭，最高位固定0
 2) 按天间隔重复时：表示每x天提醒一次，1表示每天，最多31天
 3) 按小时重复时：单位为0.5小时，例如3表示1.5小时（每90分钟提醒一次）
*/
/// 开始时间
@property (nonatomic, assign) UInt16 startYear;       // 年，不设置置为0xFFFF
@property (nonatomic, assign) UInt8 startMonth;       // 月：1–12，不设置置为0xFF
@property (nonatomic, assign) UInt8 startDay;         // 日：1–31，不设置置为0xFF
@property (nonatomic, strong) NSValue *startTimeValue; // 开始单个时间段

/// 结束时间
@property (nonatomic, assign) UInt16 endYear;         // 年，不设置置为0xFFFF
@property (nonatomic, assign) UInt8 endMonth;         // 月：1–12，不设置置为0xFF
@property (nonatomic, assign) UInt8 endDay;           // 日：1–31，不设置置为0xFF
@property (nonatomic, strong) NSValue *endTimeValue;   // 结束单个时间段

#pragma mark - 开始时间 Set/Get

- (void)setStartTimeWithHour:(UInt8)hour minute:(UInt8)minute;
- (void)getStartTime:(RemindTime *)time;

#pragma mark - 结束时间 Set/Get

- (void)setEndTimeWithHour:(UInt8)hour minute:(UInt8)minute;
- (void)getEndTime:(RemindTime *)time;

//MARK: - 数据拼接
- (NSData *)toDeviceData;

@end

NS_ASSUME_NONNULL_END
