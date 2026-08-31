import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

interface AppScreenProps {
  children: ReactNode;
  scroll?: boolean;
  tone?: 'plain' | 'soft';
  bottomInset?: number;
}

export function AppScreen({ children, scroll = true, tone = 'plain', bottomInset = 16 }: AppScreenProps) {
  const backgroundColor = tone === 'soft' ? colors.backgroundSoft : colors.background;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor }]} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, { paddingBottom: bottomInset }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12
  }
});
