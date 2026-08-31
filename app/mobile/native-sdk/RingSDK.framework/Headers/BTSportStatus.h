//
//  BTSportStatus.h
//  RingSDK
//
//  Created by kaoji on 6/8/24.
//

#import <Foundation/Foundation.h>
#import <RingSDK/RingDef.h>

NS_ASSUME_NONNULL_BEGIN

/// 设备运动状态类。Device sports status class.
@interface BTSportStatus : NSObject

/// 运动状态类型。Type of the sport status.
@property (nonatomic, assign) BTSportStatusType status;

/// 运动类型。Type of sport.
@property (nonatomic, assign) BTSportType sportType;

/// 运动操作类型。Type of sport operation.
@property (nonatomic, assign) BTSportOperationType operationType;

/// 运动会话标识符。Identifier of the sport session.
@property (nonatomic, strong) NSData *sportID;

/// 初始化方法，通过解析数据设置状态和会话标识。
/// Initializes the instance by parsing data to set status and session identifier.
/// @param data 包含状态和会话标识的数据。Data containing status and session identifier.
/// @return 返回初始化的对象。Returns an initialized object.
- (instancetype)initWithData:(NSData *)data;

@end

NS_ASSUME_NONNULL_END
