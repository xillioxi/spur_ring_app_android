/// RingDef.h
/// RingSDK
//
/// Created by Kaoji on 2024/05/13.

#define BLEDidReceiveDataNotification @"BLEDidReceiveDataNotification"

#pragma mark - Pairing & Connection 配对连接
/// 定义戒指配对各状态：连接与鉴权。Defines states of ring pairing: connection and authentication.
typedef NS_ENUM(NSInteger, BTDeviceStatus) {

    // 鉴权命令发送失败。Authentication command sending failed.
    BTDeviceStatusAuthCmdSendFail = -8,
    // 已断开连接。Disconnected.
    BTDeviceStatusDisconnected = -7,
    // 终端已移除配对信息。Pairing information removed by terminal.
    BTDeviceStatusPairingRemoved = -6,
    // 设备已关闭。Device off.
    BTDeviceStatusOff = -5,
    // 未绑定设备。Device not bound.
    BTDeviceStatusNoPair = -4,
    // 正在连接中。Connecting.
    BTDeviceStatusConnecting = -3,
    // 已成功连接。Connected.
    BTDeviceStatusConnected = -2,
    // 连接失败。Connection failed.
    BTDeviceStatusConnectFailed = -1,
    // 戒指端拒绝配对。Pairing refused by ring side.
    BTDeviceStatusAuthRefused = 0x00,
    // 鉴权成功。Authentication successful.
    BTDeviceStatusAuthSuccess = 0x01,
    // 绑定失败，设备已被其他手机绑定。Binding failed, already bound to another phone.
    BTDeviceStatusAuthBound = 0x02,
    // 鉴权失败，非法厂商。Authentication failed, illegal manufacturer.
    BTDeviceStatusAuthIllegal = 0x03,
    // 绑定其他设备，充电中，戒指正在重启并擦除数据。Binding to another device, charging, ring resetting and erasing data.
    BTDeviceStatusBoundOtherCharging = 0x13,
    // 绑定其他设备，不在充电中，戒指不会重启擦除数据。Binding to another device, not charging, ring will not reset.
    BTDeviceStatusBoundOtherNotCharging = 0x23
};


#pragma mark - Device Info & Control 设备信息和控制
/// 充电状态。Charging statuses.
typedef NS_ENUM(NSInteger, BTChargeStatus) {
    /// 充电中。Charging.
    BTChargeStatusCharging,
    /// 未充电。Not charging.
    BTChargeStatusNotCharging
};

/// 设备操作类型。Device operation types.
typedef NS_ENUM(NSUInteger, BTOperationType) {
    /// 重置。Reset.
    BTOperationTypeReset = 0x01,
    /// 解绑。Unbind.
    BTOperationTypeUnbind = 0x02,
    /// 重启。Restart.
    BTOperationTypeRestart = 0x04
};

/// 设备配置类型。Device configuration types.
typedef NS_ENUM(Byte, BTConfigType) {
    /// 设置。Settings.
    BTConfigTypeSettings = 0x01,
    /// 状态。Status.
    BTConfigTypeStatus = 0x02,
    /// 信息。Information.
    BTConfigTypeInformation = 0x03,
    /// 功能列表。Features List.
    BTConfigTypeFeatures = 0x04
};

#pragma mark - OTA Firmware Upgrade 固件升级
/// OTA更新状态。OTA update statuses.
typedef NS_ENUM(NSInteger, BTOTAUpdateStatus) {
    /// 准备中。Preparing.
    BTOTAUpdateStatusPreparing,
    /// 解析文件。Parsing file.
    BTOTAUpdateStatusParsingFile,
    /// 开始升级。OTA started.
    BTOTAUpdateStatusStarted,
    /// 更新中。In progress.
    BTOTAUpdateStatusProgress,
    /// 成功。Success.
    BTOTAUpdateStatusSuccess,
    /// 失败。Failed.
    BTOTAUpdateStatusFailed,
    /// 未连接。Not connected.
    BTOTAUpdateStatusNotConnected,
    /// 文件无效。Invalid file.
    BTOTAUpdateStatusFileNotValid,
    /// 下载中。Downloading.
    BTOTAUpdateStatusDownloading
};

#pragma mark - Touch 触控
/// 触控模式。Touch modes.
typedef NS_ENUM(UInt8, BTTouchMode) {
    /// 自由模式。Free Mode.
    BTTouchModeFree = 0x00,
    /// 音乐模式。Music Mode.
    BTTouchModeMusic = 0x01,
    /// 拍照模式。Photo Mode.
    BTTouchModePhoto = 0x02,
    /// 视频模式。Video Mode.
    BTTouchModeVideo = 0x03,
    /// 阅读模式(左右翻页)。Reading Mode (Left-Right Page Turning).
    BTTouchModeReadingLR = 0x04,
    /// 阅读模式(上下滑动)。Reading Mode (Up-Down Scrolling).
    BTTouchModeReadingUD = 0x05,
    /// 幻灯片模式。Slide Show Mode.
    BTTouchModeSlideShow = 0x06,
    /// 电视遥控模式。TV Remote Control Mode.
    BTTouchModeTVRemote = 0x07,
    /// 网页浏览模式。Web Browsing Mode.
    BTTouchModeWebBrowsing = 0x08,
    /// 魔方模式。Magic Cube Mode.
    BTTouchModeMagicCube = 0x09,
    /// 传情模式。Sentimental Mode.
    BTTouchModeSentimental = 0x11,
    /// 自定义模式。Custom Mode.
    BTTouchModeCustom = 0xA1
};

//// 触控状态。Touch state.
typedef NS_ENUM(UInt8, BTTouchState) {
    /// 关闭。Off.
    BTTouchStateOff = 0x00,
    /// 打开。On.
    BTTouchStateOn = 0x01
};

#pragma mark - Measure 测量
/// 测量类型。Measurement types.
typedef NS_ENUM(UInt8, BTMeasureType) {
    /// 心率。Heart Rate.
    BTMeasureTypeHr = 0x01,
    /// 血氧。Blood Oxygen.
    BTMeasureTypeSpo2 = 0x02,
    /// 血压(不支持)。Blood Pressure (unsupported).
    BTMeasureTypeBp = 0x03,
    /// 心电。ECG.
    BTMeasureTypeEcg = 0x04,
    /// 呼吸(不支持)。Respiration (unsupported).
    BTMeasureTypeResp = 0x05,
    /// 体温。Body Temperature.
    BTMeasureTypeTemp = 0x06,
    /// 身体成份。Body Composition.
    BTMeasureTypeBodyComp = 0x07,
    /// 血糖。Glucose.
    BTMeasureTypeGlucose = 0x08,
    /// 压力。Stress.
    BTMeasureTypeStress = 0x09,
    //  其它 测试 other test
    BTMeasureTypeOther = 0x10,
    // 紫外线测量 / Ultraviolet (UV) Measurement
    BTMeasureTypeUV = 0x0A,
};

/// 睡眠类型。Sleep modes.
typedef NS_ENUM(NSUInteger, SleepMode) {
    /// 浅睡。Light sleep.
    SleepModeLight = 0x01,
    /// 深睡。Deep sleep.
    SleepModeDeep = 0x02,
    /// 清醒。Awake.
    SleepModeAwake = 0x03,
    /// 未配戴。Not worn.
    SleepModeNotWorn = 0x04,
    /// 快速眼动。Rapid Eye Movement.
    SleepModeREM = 0x05,
    /// 关机。Shutdown.
    SleepModeShutdown = 0x07
};

///// 运动类型。Types of activities.
//typedef NS_ENUM(Byte, BTSportType) {
//    /// 室内步行。Indoor walking.
//    BTSportTypeIndoorWalk = 0x05,
//
//    /// 室内单车。Indoor biking.
//    BTSportTypeIndoorBike = 0x07,
//
//    /// 室内跑步。Indoor running.
//    BTSportTypeIndoorRun = 0x08,
//
//    /// 室外步行。Outdoor walking.
//    BTSportTypeOutdoorWalk = 0x09,
//
//    /// 室外跑步。Outdoor running.
//    BTSportTypeOutdoorRun = 0x0A,
//
//    /// 室外骑行。Outdoor biking.
//    BTSportTypeOutdoorBike = 0x0B
//};

/// 运动类型。Types of activities.
typedef NS_ENUM(Byte, BTSportType) {
    /// 室内步行。Indoor walking.
    BTSportTypeIndoorWalk = 0x05,

    /// 室内单车。Indoor biking.
    BTSportTypeIndoorBike = 0x07,

    /// 室内跑步。Indoor running.
    BTSportTypeIndoorRun = 0x08,

    /// 室外步行。Outdoor walking.
    BTSportTypeOutdoorWalk = 0x09,

    /// 室外跑步。Outdoor running.
    BTSportTypeOutdoorRun = 0x0A,

    /// 室外骑行。Outdoor biking.
    BTSportTypeOutdoorBike = 0x0B,
    
    ///自由活动 Free sport
    BTSportTypeFree = 0x0F
};


typedef enum : UInt8 {
    // SportTypeAll 在使用时，需要重新赋值： -1
    BLESportTypeAll                = 0,
    BLESportTypeRun                = 0x0A, // 户外跑步（无GPS)
    BLESportTypeBike               = 0x0B, // 户外骑行（无GPS)
    BLESportTypeWalk               = 0x09, // 室内步行（无GPS)
    BLESportTypeClimb              = 0x04, // 爬山 （无GPS)
    
    BLESportTypeOutdoorRun         = 0x01, // 户外跑步
    BLESportTypeSkipRope           = 0x02, // 跳绳
    BLESportTypeOutdoorWalk        = 0x03, // 户外步行
    BLESportTypeOutdoorClimb       = 0x04, // 爬山 （GPS)
    BLESportTypeIndoorWalk         = 0x05, // 室内步行
    BLESportTypeOutdoorBike        = 0x06, // 户外骑行
    BLESportTypeIndoorBike         = 0x07, // 室内单车
    BLESportTypeIndoorRun          = 0x08, // 室内跑步
    BLESportTypeHike               = 0x0D, // 徒步
    BLESportTypeFree               = 0x0F, // 自由活动
    BLESportTypeTaiji              = 0x10, // 太极
    BLESportTypeYoga               = 0x11, // 瑜珈
    BLESportTypeDance              = 0x12, // 跳舞
    BLESportTypeGymanastics        = 0x13, // 体操
    BLESportTypeBoating            = 0x14, // 划船
    BLESportTypeAngling            = 0x15, // 钓鱼
    BLESportTypeRoller             = 0x16, // 轮滑
    BLESportTypeLiftWeight         = 0x17, // 举重
    BLESportTypeClimbStari         = 0x18, // 爬楼梯
    BLESportTypeSwim               = 0x19, // 游泳
    BLESportTypeFootball           = 0x20, // 足球
    BLESportTypeBasketball         = 0x21, // 篮球
    BLESportTypeVolleyball         = 0x22, // 排球
    BLESportTypeBadminton          = 0x23, // 羽毛球
    BLESportTypePingPong           = 0x24, // 乒乓球
    BLESportTypeTennis             = 0x25, // 网球
    BLESportTypeBaseball           = 0x26, // 棒球
    BLESportTypeCricket            = 0x27, // 板球
    BLESportTypeRugby              = 0x28, // 橄榄球
    BLESportTypeHockey             = 0x29, // 曲棍球
    BLESportTypeEllipMachine       = 0x30, // 椭圆机
    BLESportTypeRowMachine         = 0x31, // 划船机
    BLESportTypeStepper            = 0x32, // 跑步机
    BLESportTypeStairMachine       = 0x33, // 楼梯机
    BLESportTypeSitup              = 0x3A, // 仰卧起坐
} BLESportType;

/// 运动操作类型。Types of activities.
typedef NS_ENUM(UInt16, BTSportOperationType) {
    /// 开始 - Start
    BTSportOperationTypeStart = 0x9611,

    /// 暂停 - Pause
    BTSportOperationTypePause = 0x9612,

    /// 恢复 - Resume
    BTSportOperationTypeResume = 0x9613,

    /// 停止 - Stop
    BTSportOperationTypeStop = 0x9614,
};

/// 运动的不同状态。Enumeration for different sports statuses.
typedef NS_ENUM(NSUInteger, BTSportStatusType) {
    /// 已开始 - Started
    BTSportStatusTypeStarted = 0,
    
    /// 开始失败 - Start Failed
    BTSportStatusTypeStartFailed = 1,
    
    /// 已暂停 - Paused
    BTSportStatusTypePaused = 2,
    
    /// 暂停失败 - Pause Failed
    BTSportStatusTypePauseFailed = 3,
    
    /// 已恢复 - Resumed
    BTSportStatusTypeResumed = 4,
    
    /// 恢复失败 - Resume Failed
    BTSportStatusTypeResumeFailed = 5,
    
    /// 已停止 - Stopped
    BTSportStatusTypeStopped = 6,
    
    /// 停止失败 - Stop Failed
    BTSportStatusTypeStopFailed = 7,
    
    /// 运动中 - Active. 若运动中，需先停再开始新的运动。If active, stop before starting a new activity.
    BTSportStatusTypeActive = 8,
    
    /// 数据未上传 - 如果数据未上传，需要先同步数据再开始新的运动。Data Not Uploaded. Sync data before starting a new activity.
    BTSportStatusTypeUnsynced = 9,

    /// 没有运动 - No Sport. 表示没有正在进行的运动。Indicates no sport is ongoing.
    BTSportStatusTypeNoSport = 10,
    
    /// 数据上传中 - 数据正在上传，请等待上传完成后再开始新的运动。Data is being uploaded. Please wait until the upload is complete before starting a new activity.
    BTSportStatusTypeUploadingData = 11,
};


/// 震动类型枚举。Vibration types.
typedef NS_ENUM(Byte, BTVibrationType) {
    BTVibrationTypeAll = 0x00,
    /// 系统事件提醒。System Event Notification.
    BTVibrationTypeSystemEvent = 0x01,
    
    /// 健康预警。Health Alert.
    BTVibrationTypeHealthAlert = 0x02,
    
    /// 闹钟。Alarm.
    BTVibrationTypeAlarm = 0x03,
    
    /// 来电提醒。Incoming Call Notification.
    BTVibrationTypeIncomingCall = 0x04,
    
    /// 消息提醒。Message Notification.
    BTVibrationTypeMessage = 0x05,
    
    /// 关爱提醒。Care Reminder.
    BTVibrationTypeCareReminder = 0x06
};

/// 健康预警类型。Health warning types.
typedef NS_ENUM(Byte, BTHealthWarningType) {
    /// 心率预警。Heart rate warning.
    BTHealthWarningTypeHeartRate = 0x01,
    
    /// 血氧预警。Blood oxygen warning.
    BTHealthWarningTypeBloodOxygen = 0x02,
    
    /// 体温预警。Body temperature warning.
    BTHealthWarningTypeBodyTemperature = 0x03,
    
    /// 压力预警。Stress warning.
    BTHealthWarningTypeStress = 0x04
};

/// 健康预警子类型。Health warning sub types.
typedef NS_ENUM(NSUInteger, BTHealthWarningSubType) {
    
    // 高阈值。 High thresold.
    BTHealthWarningSubTypeHigh,
    
    // 低阈值。 low thresold.
    BTHealthWarningSubTypeLow
};

typedef NS_ENUM(NSUInteger, BTRTPPIStatus) {
    BTRTPPIStatusIdle           = 0x01, // 空闲状态，可启动测量
    BTRTPPIStatusMeasuring      = 0x02, // 正在进行测量或运动
    BTRTPPIStatusPaused         = 0x03, // 测量或运动暂停中
    BTRTPPIStatusPendingUpload  = 0x04, // 有运动或测量数据待上传
    BTRTPPIStatusUploading      = 0x05  // 数据上传中
};

typedef NS_ENUM(NSUInteger, BTRTPPIType) {
    BTRTPPITypeLOVIng    = 0x0A, // 空闲状态，可启动测量
    BTRTPPITypePPI      = 0x0B, // 正在进行测量或运动
};
