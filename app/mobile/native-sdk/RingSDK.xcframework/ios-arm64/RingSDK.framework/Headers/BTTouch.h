//
//  BTTouch.h
//  RingSDK
//
//  Created by Kaoji on 2024/5/27.
//

#import <Foundation/Foundation.h>
#import <RingSDK/BTTouchModel.h>
#import <RingSDK/BTTouchEventModel.h>


NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSUInteger, BTTouchVideoMode) {
    BTTouchVideoModeFast = 0x01,  // 高灵敏度
    BTTouchVideoModeSlow = 0x02   // 低灵敏度
};

typedef NS_ENUM(NSUInteger, BTTouchWorkingState) {
    BTTouchWorkingStateAwake = 0x00,    // 唤醒/监听
    BTTouchWorkingStateSleep = 0x01   // 休眠
};

// 监听触控工作模式
typedef void (^BTTouchWokingStateBlock)(BTTouchWorkingState state);

/// 监听触控事件
/// Listening touch operation
/// @param completion 完成回调，返回戒指上报的触控事件列表。Completion callback, returning the touch events list on the smart ring.
/// @discussion 触控动作：0x0103 长按，0x0104 向上滑动，0x0105 向下滑动。Touch operation: 0x0103 Long press，0x0104 Wipe up，0x0105 Wipe down.
typedef void (^BTTouchEventModelBlock)(NSMutableArray<BTTouchEventModel*> *touchList);


/// 设备控制器类，用于管理设备的触控模式和状态
/// Device controller class, used for managing the touch mode and state of the device
@interface BTTouch : NSObject

@property(nonatomic, copy) BTTouchWokingStateBlock workingHandle;

@property(nonatomic, copy) BTTouchEventModelBlock touchListeningHandle;


/// 获取设备当前触控工作状态
/// Fetch the current working state of the touch
- (void)fetchTouchWorkingState;

//MARK: -设置设备发送触控区休眠状态 参数:BTTouchWorkingState result:1成功 2 失败
//Set the device to send touch area sleep state.Parameter: BTTouchWorkingState Result: 1 - Success, 2 - Failure.
-(void)updateTouchWorkingState:(BTTouchWorkingState)state  completion:(void (^)(BOOL success))completion;

/// 获取设备当前触控状态
/// Fetch the current state of the touch
/// @param completion 完成回调，返回触控状态。Completion callback, returning the touch state.
/// @discussion YES 表示成功发送指令，NO 表示重复发送或发送失败。YES indicates the command was sent successfully, NO indicates a duplicate or failure.
- (BOOL)fetchTouchState:(void (^)(BTTouchModel * _Nullable state))completion;

/// 更新设备触控状态
/// Update the state of the touch
/// @param state 新的触控状态。The new touch state.
/// @param completion 完成回调，返回操作是否成功。Completion callback, returning whether the operation was successful.
/// @discussion YES 表示成功发送指令，NO 表示重复发送或发送失败。YES indicates the command was sent successfully, NO indicates a duplicate or failure.
- (BOOL)updateTouchState:(BTTouchModel *)state completion:(void (^)(BOOL success))completion;

/// 设置视频触控模式为高速或低速
/// Set the video touch mode to either fast (high sensitivity) or slow (low sensitivity)
/// @param mode 视频触控模式（高速或低速）。The video touch mode (fast or slow).
/// @param completion 完成回调，返回操作是否成功。Completion callback, returning whether the operation was successful.
/// @discussion YES 表示成功发送指令，NO 表示重复发送或发送失败。YES indicates the command was sent successfully, NO indicates a duplicate or failure.
- (BOOL)updateVideoTouchMode:(BTTouchVideoMode)mode completion:(void (^)(BOOL success))completion;

/// 查询当前设备的视频触控模式
/// Query the current video touch mode of the device
/// @param completion 完成回调，返回当前的触控模式。Completion callback, returning the current video touch mode.
/// @discussion YES 表示成功发送指令，NO 表示重复发送或发送失败。YES indicates the command was sent successfully, NO indicates a duplicate or failure.
- (BOOL)queryVideoTouchMode:(void (^)(BTTouchVideoMode mode))completion;

/// 监听设备的触控操作事件
/// Listening touch operation
/// @param completion 完成回调，返回戒指上报的触控事件列表。Completion callback, returning the touch events list on the smart ring.
/// @discussion 触控动作：0x0103 长按，0x0104 向上滑动，0x0105 向下滑动。Touch operation: 0x0103 Long press，0x0104 Wipe up，0x0105 Wipe down.
- (void)listeningTouchEvent:(void (^)(NSMutableArray<BTTouchEventModel*> *touchList))completion;

/// 查询设备触控休眠开关状态
- (BOOL)getTouchSleepStatus:(void (^)(BOOL status))completion;
/// 设置设备触控休眠开关状态
- (BOOL)setTouchSleepStatus:(BOOL)isSwitch completion:(void (^)(BOOL success))completion;
@end

NS_ASSUME_NONNULL_END
