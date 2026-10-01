import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RingAppScreen } from '@/ui-v2/RingAppScreen';
import { SyncHubScreen } from '@/screens/sync/SyncHubScreen';
import { YanqiangVoiceDebugScreen } from '@/screens/device/YanqiangVoiceDebugScreen';
import { ConnectLaptopScreen } from '@/screens/device/ConnectLaptopScreen';
import { CloudOfficeScreen } from '@/screens/office/CloudOfficeScreen';
import { YanqiangRecordingDebugScreen } from '@/screens/device/YanqiangRecordingDebugScreen';
import { YanqiangButtonDebugScreen } from '@/screens/device/YanqiangButtonDebugScreen';
import { MeScreen } from '@/screens/me/MeScreen';
import { LocalRecordingResultScreen } from '@/screens/recordings/LocalRecordingResultScreen';
import type { RootStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="RingApp" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RingApp" component={RingAppScreen} />
      <Stack.Screen name="Sync" component={SyncHubScreen} />
      <Stack.Screen name="Device" component={YanqiangVoiceDebugScreen} />
      <Stack.Screen name="ConnectLaptop" component={ConnectLaptopScreen} />
      <Stack.Screen name="CloudOffice" component={CloudOfficeScreen} />
      <Stack.Screen name="Me" component={MeScreen} />
      <Stack.Screen name="RecordingSummary" component={LocalRecordingResultScreen} />
      <Stack.Screen name="YanqiangRecordingDebug" component={YanqiangRecordingDebugScreen} />
      <Stack.Screen name="YanqiangButtonDebug" component={YanqiangButtonDebugScreen} />
    </Stack.Navigator>
  );
}
