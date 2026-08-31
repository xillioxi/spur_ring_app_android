#import <QuickLook/QuickLook.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>

@interface SpurFilePreview : NSObject <RCTBridgeModule, QLPreviewControllerDataSource>
@property (nonatomic, copy) NSURL *fileURL;
@property (nonatomic, strong) QLPreviewController *controller;
@end

@implementation SpurFilePreview

RCT_EXPORT_MODULE(SpurFilePreview)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(preview:(NSString *)uri
                  fileName:(NSString *)fileName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSURL *url = nil;
    if ([uri hasPrefix:@"file://"]) {
      url = [NSURL URLWithString:uri];
    } else if (uri.length > 0) {
      url = [NSURL fileURLWithPath:uri];
    }
    if (!url.path.length || ![[NSFileManager defaultManager] fileExistsAtPath:url.path]) {
      reject(@"ENOENT", @"找不到本机文件", nil);
      return;
    }

    NSString *title = [fileName stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (title.length > 0 && ![url.lastPathComponent isEqualToString:title]) {
      NSURL *named = [NSURL fileURLWithPath:[url.path.stringByDeletingLastPathComponent stringByAppendingPathComponent:title]];
      NSError *copyError = nil;
      [[NSFileManager defaultManager] removeItemAtURL:named error:nil];
      if ([[NSFileManager defaultManager] copyItemAtURL:url toURL:named error:&copyError]) {
        url = named;
      }
    }

    if (![QLPreviewController canPreviewItem:url]) {
      reject(@"UNSUPPORTED", @"当前文件无法在 App 内预览", nil);
      return;
    }

    self.fileURL = url;
    QLPreviewController *controller = [QLPreviewController new];
    controller.dataSource = self;
    self.controller = controller;

    UIViewController *presenter = RCTPresentedViewController();
    if (!presenter) {
      reject(@"NOVC", @"无法打开预览", nil);
      return;
    }
    [presenter presentViewController:controller animated:YES completion:^{
      resolve(@YES);
    }];
  });
}

- (NSInteger)numberOfPreviewItemsInPreviewController:(QLPreviewController *)controller
{
  return self.fileURL ? 1 : 0;
}

- (id<QLPreviewItem>)previewController:(QLPreviewController *)controller previewItemAtIndex:(NSInteger)index
{
  return self.fileURL;
}

@end
