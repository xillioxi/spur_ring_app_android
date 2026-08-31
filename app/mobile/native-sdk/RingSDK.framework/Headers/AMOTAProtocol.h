#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(uint8_t, AMOTACommand) {
  AMOTACommandUnknown = 0,
  AMOTACommandFWHeader = 1,
  AMOTACommandFWData = 2,
  AMOTACommandFWVerify = 3,
  AMOTACommandFWReset = 4,
};

FOUNDATION_EXPORT NSUUID *AMOTAServiceUUID(void);
FOUNDATION_EXPORT NSUUID *AMOTARxCharacteristicUUID(void); // write
FOUNDATION_EXPORT NSUUID *AMOTATxCharacteristicUUID(void); // notify

FOUNDATION_EXPORT NSUInteger AMOTAMaxFramePayload(void);   // 20
FOUNDATION_EXPORT NSUInteger AMOTAFWPacketSize(void);      // 512
FOUNDATION_EXPORT NSUInteger AMOTAFWHeaderSize(void);      // 48

@interface AMOTAProtocol : NSObject

/// Build command packet:
/// length(2B LE) + cmd(1B) + payload(len) + crc32(4B LE), where length == payloadLen + 4.
+ (NSData *)buildCommandPacket:(AMOTACommand)cmd payload:(nullable NSData *)payload;

/// Parse ACK/response command type from raw TX data.
+ (AMOTACommand)parseResponseCommand:(NSData *)response;

/// Parse response status byte (0 = OK). Returns -1 if not available.
+ (int)parseResponseStatus:(NSData *)response;

/// For FW_HEADER response, parse resume offset (LE uint32 at bytes 4..7). Returns NO if not available.
+ (BOOL)parseHeaderResponseOffset:(NSData *)response offset:(uint32_t *)offsetOut;

@end

NS_ASSUME_NONNULL_END

