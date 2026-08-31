//
//  BTAlarm.h
//  AIZOSDK
//
//  Created by Kaoji on 2024/11/13.
//

//MARK: - 1 备注闹钟最多只能5个 2 ID 从1~5 3 编辑对应的类型1添加 2删除 3编辑

typedef NS_ENUM(UInt8, BTAlarmType) {
    BTAlarmTypeAdd = 0x01,  ///< 增加。Add.
    BTAlarmTypeDelete = 0x02, ///< 删除。Delete.
    BTAlarmTypeModify = 0x03  ///< 修改。Modify.
};

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 闹钟数据模型。Alarm data model.
@interface BTAlarm : NSObject

/// 闹钟ID。Alarm ID.
@property (nonatomic, assign) UInt8 alarmID;

/// 响铃时长（分钟）。Duration in minutes.
@property (nonatomic, assign) UInt8 duration;

/// 重复设置（二进制表示）。Repeat settings (binary representation). 设置星期
@property (nonatomic, assign) UInt8 repeatDays;

/// 闹钟时间（小时）。Alarm time (hour).
@property (nonatomic, assign) UInt8 hour;

/// 闹钟时间（分钟）。Alarm time (minute).
@property (nonatomic, assign) UInt8 minute;

/// 闹钟开关状态。Alarm switch status.
@property (nonatomic, assign) BOOL isOn;

/// 闹钟名称（Unicode字符串）。Alarm name (Unicode string).
@property (nonatomic, copy) NSString *name;

/// 初始化闹钟数据。Initialize alarm data.
/// @param data 单条闹钟数据。Single alarm data.
- (instancetype)initWithData:(NSData *)data;

/// 闹钟星期是否重复 否则只响一次
@property (nonatomic, assign) BOOL isRepeatDays;//默认重复不传可以不设置

// 0x01 增0x02 删0x03改
@property (nonatomic, assign) BTAlarmType type;

/// 1 2 3 4 5 6 7对应周一~周日 用来显示
@property (nonatomic, strong) NSArray *weekdays;

- (NSDictionary *)toDictionary;

// 通过[1 2 3 4 5 6 7]转换成repeatDays
+ (UInt8)encodeWeeksDays:(NSArray<NSNumber *> *)selectedDays;
// 辅助方法时间date格式转时间data
+ (NSData *)getZeroTimeIntervalDataByDate:(NSDate *)date;



@end

NS_ASSUME_NONNULL_END
