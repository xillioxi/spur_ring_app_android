export type RootStackParamList = {
  MainTabs: undefined;
  Sync: undefined;
  LegacyUI: undefined;
  ReferenceUI: undefined;
  Device: undefined;
  ConnectLaptop: undefined;
  CloudOffice: undefined;
  Me: undefined;
  RecordingSummary: { id: string };
  Transcript: { id: string };
  YanqiangRecordingDebug: { macAddress: string };
  YanqiangButtonDebug: { macAddress: string };
  DeviceDetail: { deviceId?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Records: undefined;
  Assistants: undefined;
};
