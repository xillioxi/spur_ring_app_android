export const ringProtocol = {
  audioFormat: {
    codec: 'pcm',
    sampleFormat: 's16le',
    sampleRateHz: 8000,
    channels: 1
  },
  pendingHardwareSpec: [
    'BLE 广播名或过滤规则',
    'Service UUID / Characteristic UUID',
    '命令码、包头、大小端、payload 结构',
    '分片大小、ACK、CRC、重试和断点续传',
    '文件列表、文件下载、删除、时间同步、电量读取、OTA 协议'
  ]
} as const;
