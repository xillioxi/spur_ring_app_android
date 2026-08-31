//
//  SNBLELogManager.h
//  project
//
//  Created by 圆圆陈 on 2018/4/2.
//  Copyright © 2018年 黄建华. All rights reserved.
//

#import <Foundation/Foundation.h>
#define LogWrite(header,content,footer) [[SNBLELogManager sharedInstance] writeWithHeader:header WithContent:content WithFooter:footer];
//
#define LogWriteNew(header,content) [[SNBLELogManager sharedInstance] writeWithHeaderNew:header WithContent:content WithFooter:@""];

//MARK: -新的APP日志路径 如连接 运动模式 设备激活网络请求
#define LogWriteNewAPPlog(header,content) [[SNBLELogManager sharedInstance] writeWithHeaderAPPLogEveryDayNew:header WithContent:content WithFooter:@""];

//MARK: -新的APP日志路径 cc61 cc71 cc81 c821等等
#define LogWriteNewAPPlogV3(header,content,name) [[SNBLELogManager sharedInstance] writeWithHeaderAPPLogEveryDayNewV3:header WithContent:content WithFooter:@"" fileName:name];

@interface SNBLELogManager : NSObject
@property(nonatomic,assign)NSInteger breakTimes;
@property(nonatomic,assign)NSInteger errorTimes;
// 日志的目录路径
@property (nonatomic,copy) NSString* basePath;
+ (instancetype) sharedInstance;


-(void)writeWithHeader:(NSString *)header WithContent:(NSString *)content WithFooter:(NSString *)footer;

-(void)writeWithHeaderNew:(NSString *)header WithContent:(NSString *)content WithFooter:(NSString *)footer;


//MARK: -新的APP日志路径 如连接 运动模式 设备激活网络请求
-(void)writeWithHeaderAPPLogEveryDayNew:(NSString *)header WithContent:(NSString *)content WithFooter:(NSString *)footer;

//MARK: -新的APP日志路径 cc61 cc71 cc81 c821等等
-(void)writeWithHeaderAPPLogEveryDayNewV3:(NSString *)header WithContent:(NSString *)content WithFooter:(NSString *)footer fileName:(NSString *)name;

@end
