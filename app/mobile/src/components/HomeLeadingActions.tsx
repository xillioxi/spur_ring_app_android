import { StyleSheet, View } from 'react-native';

import { DeviceEntryButton } from '@/components/DeviceEntryButton';
import { ProfileEntryButton } from '@/components/ProfileEntryButton';

export function HomeLeadingActions() {
  return (
    <View style={styles.row}>
      <DeviceEntryButton />
      <ProfileEntryButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  }
});
