import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Bot, Home, Mic2 } from 'lucide-react-native';

import { AgentFlowScreen } from '@/screens/assistant/AgentFlowScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { SyncHubScreen } from '@/screens/sync/SyncHubScreen';
import { LegacyAppNavigator } from '@/legacy/LegacyAppNavigator';
import { YanqiangVoiceDebugScreen } from '@/screens/device/YanqiangVoiceDebugScreen';
import { ConnectLaptopScreen } from '@/screens/device/ConnectLaptopScreen';
import { CloudOfficeScreen } from '@/screens/office/CloudOfficeScreen';
import { YanqiangRecordingDebugScreen } from '@/screens/device/YanqiangRecordingDebugScreen';
import { YanqiangButtonDebugScreen } from '@/screens/device/YanqiangButtonDebugScreen';
import { MeScreen } from '@/screens/me/MeScreen';
import { RecordingListScreen } from '@/screens/recordings/RecordingListScreen';
import { LocalRecordingResultScreen } from '@/screens/recordings/LocalRecordingResultScreen';
import { TranscriptScreen } from '@/screens/recordings/TranscriptScreen';
import { colors } from '@/theme/colors';
import { t } from '@/locales';
import { ReferenceUI } from '@/ui-v2/ReferenceUI';
import type { MainTabParamList, RootStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Sync" component={SyncHubScreen} />
      <Stack.Screen name="LegacyUI" component={LegacyAppNavigator} />
      <Stack.Screen name="ReferenceUI" component={ReferenceUI} />
      <Stack.Screen name="Device" component={YanqiangVoiceDebugScreen} />
      <Stack.Screen name="ConnectLaptop" component={ConnectLaptopScreen} />
      <Stack.Screen name="CloudOffice" component={CloudOfficeScreen} />
      <Stack.Screen name="Me" component={MeScreen} />
      <Stack.Screen name="RecordingSummary" component={LocalRecordingResultScreen} />
      <Stack.Screen name="Transcript" component={TranscriptScreen} />
      <Stack.Screen name="YanqiangRecordingDebug" component={YanqiangRecordingDebugScreen} />
      <Stack.Screen name="YanqiangButtonDebug" component={YanqiangButtonDebugScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          height: 78,
          paddingTop: 8,
          paddingBottom: 12,
          borderTopWidth: 0,
          backgroundColor: colors.card
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700'
        }
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="Records"
        component={RecordingListScreen}
        options={{
          title: t.tabs.recordings,
          tabBarIcon: ({ color, size }) => <Mic2 color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="Assistants"
        component={AgentFlowScreen}
        options={{
          title: 'AI Assistants',
          tabBarIcon: ({ color, size }) => <Bot color={color} size={size} />
        }}
      />
    </Tabs.Navigator>
  );
}
