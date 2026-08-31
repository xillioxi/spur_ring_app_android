//
//  BTRealDataModel.h
//  RingSDK
//
//  Created by 黄建华 on 2025/3/17.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BTRealDataModel : NSObject

/// 行走距离，单位为厘米
/// Distance walked, measured in meters.
@property (nonatomic, assign) NSUInteger distance;

/// 燃烧的卡路里数，单位为千卡/大卡
/// Calories burned, measured in calories.
@property (nonatomic, assign) float calories;

/// 步数，表示行走的总步数。
/// Number of steps taken.
@property (nonatomic, assign) NSUInteger steps;

/// 年月日 时分秒
@property (nonatomic, strong) NSString *dateString;

- (instancetype)initWithData:(NSData *)data;


@end

NS_ASSUME_NONNULL_END
