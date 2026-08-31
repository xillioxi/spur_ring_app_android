import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { t } from '@/locales';

export function LoadingState({ label = t.common.loading }: { label?: string }) {
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  text: {
    color: colors.textTertiary,
    fontSize: 13
  }
});
