import Foundation

enum VoiceRecordingFileSelector {
  static func opusFileNames(in directoryURL: URL) -> Set<String> {
    Set(opusURLs(in: directoryURL).map(\.lastPathComponent))
  }

  static func preferredOpusURL(
    in directoryURL: URL,
    filesBeforeSync: Set<String>
  ) -> URL? {
    let files = opusURLs(in: directoryURL)
    let newFiles = files.filter { !filesBeforeSync.contains($0.lastPathComponent) }
    return latestURL(in: newFiles) ?? latestURL(in: files)
  }

  static func pendingOpusURLs(
    in directoryURL: URL,
    convertedBaseNames: Set<String>
  ) -> [URL] {
    opusURLs(in: directoryURL)
      .filter {
        !convertedBaseNames.contains($0.deletingPathExtension().lastPathComponent)
      }
      .sorted { lhs, rhs in
        let lhsDate = modificationDate(of: lhs)
        let rhsDate = modificationDate(of: rhs)
        if lhsDate == rhsDate {
          return lhs.lastPathComponent < rhs.lastPathComponent
        }
        return lhsDate < rhsDate
      }
  }

  private static func opusURLs(in directoryURL: URL) -> [URL] {
    guard let urls = try? FileManager.default.contentsOfDirectory(
      at: directoryURL,
      includingPropertiesForKeys: [.contentModificationDateKey],
      options: [.skipsHiddenFiles]
    ) else {
      return []
    }
    return urls.filter { $0.pathExtension.lowercased() == "opus" }
  }

  private static func latestURL(in urls: [URL]) -> URL? {
    urls.max { lhs, rhs in
      modificationDate(of: lhs) < modificationDate(of: rhs)
    }
  }

  private static func modificationDate(of url: URL) -> Date {
    (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
      ?? .distantPast
  }
}
