//
//  RingSDK.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/11.
//

#import <Foundation/Foundation.h>

#ifdef DEBUG
    #define NSLog(format, ...) NSLog((format), ##__VA_ARGS__)
#else
    #define NSLog(format, ...)
#endif


//! Project version number for RingSDK.
FOUNDATION_EXPORT double RingSDKVersionNumber;

//! Project version string for RingSDK.
FOUNDATION_EXPORT const unsigned char RingSDKVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <RingSDK/PublicHeader.h>

// Base Framework Components
#import <RingSDK/RingDef.h>
#import <RingSDK/BTService.h>
#import <RingSDK/BTBase.h>
#import <RingSDK/NSData+format.h>
#import <RingSDK/NSString+SaveToDocuments.h>

// 设备搜索模型
// search device model
#import <RingSDK/Ring.h>

// 设备信息状态和功能
// Device info, status & feature
#import <RingSDK/BTDevice.h>
#import <RingSDK/BTAboutModel.h>
#import <RingSDK/BTPowerModel.h>
#import <RingSDK/BTStatusModel.h>
#import <RingSDK/BTFeatureModel.h>
#import <RingSDK/BTAuthModel.h>

// 偏好设置
// User Preferences and Settings
#import <RingSDK/BTUserPrefs.h>
#import <RingSDK/BTIntervalModel.h>

// 固件升级
// OTA Updater
#import <RingSDK/RTKOTAUpdater.h>
#import <RingSDK/BTOTAChecker.h>
#import <RingSDK/BTOTAModel.h>

// 触摸交互
// Touch Interaction
#import <RingSDK/BTTouch.h>
#import <RingSDK/BTTouchModel.h>
#import <RingSDK/BTTouchEventModel.h>


// 健康测量
// Health and Measurement
#import <RingSDK/BTMeasure.h>
#import <RingSDK/BTMeasureResult.h>

// SOS功能
// SOS Features
#import <RingSDK/BTSOS.h>
#import <RingSDK/BTSOSStateModel.h>

// 健康数据
// Health data
#import <RingSDK/BTHealth.h>
#import <RingSDK/BTHealthModel.h>
#import <RingSDK/BTRealDataModel.h>

// 睡眠监测
// Sleep Tracking
#import <RingSDK/BTSleep.h>
#import <RingSDK/BTSleepDetailModel.h>
#import <RingSDK/BTSleepSummaryModel.h>
#import <RingSDK/BTNapDetailModel.h>

//运动
#import <RingSDK/BTSport.h>
#import <RingSDK/BTSportStatus.h>
#import <RingSDK/BTSportSummaryModel.h>
#import <RingSDK/BTSportDetailModel.h>
#import <RingSDK/BTSportRealTimeModel.h>

// 算法
// Health data
#import <RingSDK/BTHealthScore.h>
#import <RingSDK/BTScoreAlgorithm.h>

// ---------------------------->
//#warning - Not for use: 请勿使用

//Debug
#import <RingSDK/CommandsTableViewController.h>

//ECG
#import <RingSDK/BTECGValue.h>
#import <RingSDK/BTECGPacket.h>
#import <RingSDK/BTECGEndPacket.h>
#import <RingSDK/ECGDumpper.h>
#import <RingSDK/ECGFilter.h>
//身体成分
#import <RingSDK/BodyCompostionPacket.h>
// 血糖 Glu
#import <RingSDK/BTGluPacket.h>
#import <RingSDK/BTGluValue.h>

// 原始数据 OriginalData
#import <RingSDK/BTOriginalDataManager.h>
#import <RingSDK/BTOriginal.h>
#import <RingSDK/BTOriginalDataPacket.h>
#import <RingSDK/BTOriginalDataPacket+parser.h>
// <----------------------------
//#import "SNBleBase.h"

#import <RingSDK/SNBleBase.h>
#import <RingSDK/SNBleTimeUtils.h>
#import <RingSDK/SNReportData.h>
#import <RingSDK/SNBLELogManager.h>
#import <RingSDK/NSData+Conversion2.h>
#import <RingSDK/SNBleMessageNotice.h>
#import <RingSDK/LogManager.h>

//新
#import <RingSDK/BTHealthWarningSetting+Codable.h>
#import <RingSDK/BTHealthWarningSetting+Storage.h>


//#import <PSP/PSP-Swift.h>
//#import <RingSDK/RingSDK-Swift.h>
#import <RingSDK/BTInterval.h>

//实时测量PPI
#import <RingSDK/BTRtPPIModel.h>
#import <RingSDK/BTRtPPI.h>

#import <RingSDK/BTAudioManager.h>
#import <RingSDK/BTAudioPacketModel.h>
#import <RingSDK/BTAudioPacketDBManager.h>


//关爱提醒
#import <RingSDK/BTCareDataModel.h>
#import <RingSDK/BTCareHelp.h>

//其他设置
#import <RingSDK/BTZoneHelp.h>

// apo ota
#import <RingSDK/BLEAPOOTA.h>
#import <RingSDK/AMOTAProtocol.h>
#import <RingSDK/AMCRC32.h>

