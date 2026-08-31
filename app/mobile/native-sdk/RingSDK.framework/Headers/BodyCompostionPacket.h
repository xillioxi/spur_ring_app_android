//
//  BodyCompostionPacket.h
//  AIZOSDK
//
//  Created by kaoji on 9/24/23.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// 用于表示体脂数据的模型类
@interface BodyCompostionPacket : NSObject

@property (nonatomic, assign) int64_t timestamp; // 测量时间戳毫秒
@property (nonatomic, assign) float bodyFatMass; // 脂肪量
@property (nonatomic, assign) float leanBodyMass; // 去脂体重
@property (nonatomic, assign) float bmi; // BMI（身体质量指数）
@property (nonatomic, assign) float bodyFatRate; // 体脂率
@property (nonatomic, assign) float muscleMass; // 肌肉量
@property (nonatomic, assign) float skeletalMuscleMass; // 骨骼肌量
@property (nonatomic, assign) float hydration; // 水分
@property (nonatomic, assign) float hydrationRate; // 水分率
@property (nonatomic, assign) float proteinMass; // 蛋白质量
@property (nonatomic, assign) float proteinMassPercentage; // 蛋白质量百分比
@property (nonatomic, assign) float boneSaltMass; // 骨盐量
@property (nonatomic, assign) float boneSaltMassPercentage; // 骨盐量百分比
@property (nonatomic, assign) float standardWeight; // 标准体重
@property (nonatomic, assign) float basalMetabolicRate; // 基础代谢率

- (instancetype)initWithBytes:(NSData *)data;

- (BOOL)isValidData;

- (void)printAllProperties;

+ (instancetype)fromJSONString:(NSString *)jsonString;

- (NSString *)toJSONString;

@end

NS_ASSUME_NONNULL_END
