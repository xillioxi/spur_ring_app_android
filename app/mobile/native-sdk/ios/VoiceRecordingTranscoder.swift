import AVFoundation
import AudioToolbox
import Foundation

struct VoiceRecordingOpusFile {
  let sampleRate: UInt32
  let channelCount: UInt8
  let frameDurationMilliseconds: UInt16
  let frameByteCount: UInt16
  let bitrateKilobitsPerSecond: UInt16
  let payload: Data

  var packetCount: Int {
    payload.count / Int(frameByteCount)
  }
}

enum VoiceRecordingTranscoderError: LocalizedError {
  case invalidHeader(String)
  case unsupportedFormat(String)
  case converterUnavailable
  case bufferAllocationFailed
  case conversionFailed(String)

  var errorDescription: String? {
    switch self {
    case .invalidHeader(let message), .unsupportedFormat(let message):
      return message
    case .converterUnavailable:
      return "The system Opus converter is unavailable"
    case .bufferAllocationFailed:
      return "Failed to allocate an audio buffer"
    case .conversionFailed(let message):
      return message
    }
  }
}

enum VoiceRecordingTranscoder {
  private static let headerByteCount = 16
  private static let opusClockRate = 48_000.0
  private static let outputBitrate = 32_000
  private static let outputBufferDurationSeconds = 1

  static func parse(_ data: Data) throws -> VoiceRecordingOpusFile {
    guard data.count >= headerByteCount else {
      throw VoiceRecordingTranscoderError.invalidHeader("Voice recording header is truncated")
    }
    guard data[0] == 1 else {
      throw VoiceRecordingTranscoderError.unsupportedFormat(
        "Unsupported voice recording version: \(data[0])"
      )
    }

    let sampleRate = uint32LE(data, at: 1)
    let channelCount = data[5]
    let frameDuration = uint16LE(data, at: 6)
    let frameByteCount = uint16LE(data, at: 8)
    let bitrate = uint16LE(data, at: 10)

    guard sampleRate > 0, sampleRate <= 48_000 else {
      throw VoiceRecordingTranscoderError.unsupportedFormat(
        "Unsupported voice recording sample rate: \(sampleRate)"
      )
    }
    guard channelCount == 1 else {
      throw VoiceRecordingTranscoderError.unsupportedFormat(
        "Unsupported voice recording channel count: \(channelCount)"
      )
    }
    guard frameDuration > 0, frameDuration <= 120 else {
      throw VoiceRecordingTranscoderError.invalidHeader(
        "Invalid voice recording frame duration: \(frameDuration)"
      )
    }
    guard frameByteCount > 0, bitrate > 0 else {
      throw VoiceRecordingTranscoderError.invalidHeader(
        "Voice recording frame size or bitrate is invalid"
      )
    }

    let payload = Data(data.dropFirst(headerByteCount))
    guard !payload.isEmpty else {
      throw VoiceRecordingTranscoderError.invalidHeader("Voice recording has no Opus data")
    }
    guard payload.count % Int(frameByteCount) == 0 else {
      throw VoiceRecordingTranscoderError.invalidHeader(
        "Voice recording contains a truncated Opus packet"
      )
    }

    return VoiceRecordingOpusFile(
      sampleRate: sampleRate,
      channelCount: channelCount,
      frameDurationMilliseconds: frameDuration,
      frameByteCount: frameByteCount,
      bitrateKilobitsPerSecond: bitrate,
      payload: payload
    )
  }

  static func transcode(sourceURL: URL, destinationURL: URL) throws -> URL {
    let recording = try parse(Data(contentsOf: sourceURL))
    return try autoreleasepool {
      try transcode(recording, destinationURL: destinationURL)
    }
  }

  private static func transcode(
    _ recording: VoiceRecordingOpusFile,
    destinationURL: URL
  ) throws -> URL {
    let fileManager = FileManager.default
    try fileManager.createDirectory(
      at: destinationURL.deletingLastPathComponent(),
      withIntermediateDirectories: true,
      attributes: nil
    )
    if fileManager.fileExists(atPath: destinationURL.path) {
      try fileManager.removeItem(at: destinationURL)
    }

    var completed = false
    defer {
      if !completed {
        try? fileManager.removeItem(at: destinationURL)
      }
    }

    let framesPerPacket = UInt32(
      opusClockRate * Double(recording.frameDurationMilliseconds) / 1_000.0
    )
    guard framesPerPacket > 0 else {
      throw VoiceRecordingTranscoderError.invalidHeader(
        "Voice recording has an invalid decoded frame count"
      )
    }

    var inputDescription = AudioStreamBasicDescription(
      mSampleRate: opusClockRate,
      mFormatID: kAudioFormatOpus,
      mFormatFlags: 0,
      mBytesPerPacket: 0,
      mFramesPerPacket: framesPerPacket,
      mBytesPerFrame: 0,
      mChannelsPerFrame: UInt32(recording.channelCount),
      mBitsPerChannel: 0,
      mReserved: 0
    )
    guard let inputFormat = AVAudioFormat(streamDescription: &inputDescription) else {
      throw VoiceRecordingTranscoderError.unsupportedFormat(
        "Failed to create the Opus input format"
      )
    }

    let outputSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: opusClockRate,
      AVNumberOfChannelsKey: Int(recording.channelCount),
      AVEncoderBitRateKey: outputBitrate,
    ]
    let outputFile = try AVAudioFile(
      forWriting: destinationURL,
      settings: outputSettings,
      commonFormat: .pcmFormatFloat32,
      interleaved: false
    )
    let outputFormat = outputFile.processingFormat
    guard let converter = AVAudioConverter(from: inputFormat, to: outputFormat) else {
      throw VoiceRecordingTranscoderError.converterUnavailable
    }

    var packetIndex = 0
    let packetCount = recording.packetCount
    let frameByteCount = Int(recording.frameByteCount)
    let outputCapacity = AVAudioFrameCount(
      Int(opusClockRate) * outputBufferDurationSeconds
    )

    while true {
      guard let outputBuffer = AVAudioPCMBuffer(
        pcmFormat: outputFormat,
        frameCapacity: outputCapacity
      ) else {
        throw VoiceRecordingTranscoderError.bufferAllocationFailed
      }

      let packetIndexBeforeConversion = packetIndex
      var conversionError: NSError?
      let status = converter.convert(to: outputBuffer, error: &conversionError) {
        requestedPacketCount,
        inputStatus in
        guard packetIndex < packetCount else {
          inputStatus.pointee = .endOfStream
          return nil
        }

        let packetsToProvide = min(
          max(1, Int(requestedPacketCount)),
          packetCount - packetIndex
        )
        let compressedBuffer = AVAudioCompressedBuffer(
          format: inputFormat,
          packetCapacity: AVAudioPacketCount(packetsToProvide),
          maximumPacketSize: frameByteCount
        )
        let byteStart = packetIndex * frameByteCount
        let byteCount = packetsToProvide * frameByteCount
        recording.payload.copyBytes(
          to: compressedBuffer.data.assumingMemoryBound(to: UInt8.self),
          from: byteStart..<(byteStart + byteCount)
        )
        compressedBuffer.byteLength = UInt32(byteCount)
        compressedBuffer.packetCount = AVAudioPacketCount(packetsToProvide)
        for index in 0..<packetsToProvide {
          compressedBuffer.packetDescriptions?[index] = AudioStreamPacketDescription(
            mStartOffset: Int64(index * frameByteCount),
            mVariableFramesInPacket: framesPerPacket,
            mDataByteSize: UInt32(frameByteCount)
          )
        }
        packetIndex += packetsToProvide
        inputStatus.pointee = .haveData
        return compressedBuffer
      }

      if let conversionError {
        throw VoiceRecordingTranscoderError.conversionFailed(
          "Failed to decode the Opus recording: \(conversionError.localizedDescription)"
        )
      }

      switch status {
      case .haveData:
        if outputBuffer.frameLength > 0 {
          try outputFile.write(from: outputBuffer)
        }
      case .inputRanDry:
        if packetIndex == packetIndexBeforeConversion, packetIndex < packetCount {
          throw VoiceRecordingTranscoderError.conversionFailed(
            "The Opus decoder stopped before consuming all packets"
          )
        }
      case .endOfStream:
        completed = true
        return destinationURL
      case .error:
        throw VoiceRecordingTranscoderError.conversionFailed(
          "The Opus decoder reported an unknown error"
        )
      @unknown default:
        throw VoiceRecordingTranscoderError.conversionFailed(
          "The Opus decoder returned an unsupported status"
        )
      }
    }
  }

  private static func uint16LE(_ data: Data, at offset: Int) -> UInt16 {
    UInt16(data[offset]) | (UInt16(data[offset + 1]) << 8)
  }

  private static func uint32LE(_ data: Data, at offset: Int) -> UInt32 {
    UInt32(data[offset])
      | (UInt32(data[offset + 1]) << 8)
      | (UInt32(data[offset + 2]) << 16)
      | (UInt32(data[offset + 3]) << 24)
  }
}
