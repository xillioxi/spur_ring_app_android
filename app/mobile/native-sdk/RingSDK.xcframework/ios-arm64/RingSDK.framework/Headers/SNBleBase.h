////
////  SNBleBase.h
////  AIZOSDK
////
////  Created by 黄建华 on 2025/1/6.
////
//
//#import <Foundation/Foundation.h>
//
//typedef NS_ENUM(Byte, SNBTOriginalDataType) {
//    SNBTOriginalDataTypeHealth = 1,        // 健康数据 / Health data
//    SNBTOriginalDataTypeSleep = 7,         // 睡眠数据 / Sleep data
//    SNBTOriginalDataTypeNap = 3,           // 零星小睡数据 / Nap data
//    SNBTOriginalDataTypeBloodGlucose = 4,  // 血糖数据 / Blood glucose data
//    SNBTOriginalDataTypeECG = 5,           // ECG数据 / ECG data
//    SNBTOriginalDataTypePPI = 6,           // PPI数据 / PPI data
//    SNBTOriginalDataTypeOther = 0          // 其他数据 / Other data
//};
//
//NS_ASSUME_NONNULL_BEGIN
//
//@interface SNBleBase : NSObject
//
//+ (SNBleBase *)shared;
//
//@property(nonatomic, assign) BOOL canSupportPhilpsSleep;
//
//@property(nonatomic, assign) BOOL isLoadDataIng;
//
//@property(nonatomic, copy, nullable) void (^completion)(id _Nullable result, NSError * _Nullable error, BOOL success,NSString *dateString);
//
//// MARK: - 开始测量
//- (void)startReceivingWithDateIndex:(NSInteger)dateIndex
//                           dataType:(SNBTOriginalDataType)dataType
//                         completion:(void (^)(NSArray<BTSleepDetailModel *> * _Nullable result, NSError * _Nullable error, BOOL success,NSString *dateString))completion;
//@end
//
//NS_ASSUME_NONNULL_END
