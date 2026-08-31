//
//  NSString+SaveToDocuments.h
//  RingSDK
//
//  Created by Kaoji on 2024/6/18.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NSString (SaveToDocuments)

/// 将 JSON 字符串写入沙盒文稿目录
/// Save JSON string to the sandbox documents directory
/// @param name 文件名 (不需要包含扩展名 .json)  Name of the file (without .json extension)
/// @return 是否写入成功  Whether the write operation was successful
- (BOOL)saveJSONStringToDocumentsWithName:(NSString *)name;

@end

NS_ASSUME_NONNULL_END


