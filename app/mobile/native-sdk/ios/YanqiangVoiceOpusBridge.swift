import Foundation

/// ObjC-facing bridge so YanqiangVoiceModule can call the DreameRing Opus→M4A transcoder.
@objc(YanqiangVoiceOpusBridge)
public final class YanqiangVoiceOpusBridge: NSObject {
  @objc public static func transcodeOpusFile(
    atPath sourcePath: String,
    toM4APath destinationPath: String,
    error outError: NSErrorPointer
  ) -> Bool {
    do {
      _ = try VoiceRecordingTranscoder.transcode(
        sourceURL: URL(fileURLWithPath: sourcePath),
        destinationURL: URL(fileURLWithPath: destinationPath)
      )
      return true
    } catch {
      if outError != nil {
        outError?.pointee = error as NSError
      }
      return false
    }
  }

  @objc public static func pendingOpusPaths(
    inAudioDirectory audioDirectory: String,
    convertedBaseNames: [String]
  ) -> [String] {
    let urls = VoiceRecordingFileSelector.pendingOpusURLs(
      in: URL(fileURLWithPath: audioDirectory, isDirectory: true),
      convertedBaseNames: Set(convertedBaseNames)
    )
    return urls.map(\.path)
  }
}
