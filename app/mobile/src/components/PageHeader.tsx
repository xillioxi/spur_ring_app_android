import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { colors } from '@/theme/colors';

interface PageHeaderProps {
  title?: string;
  right?: ReactNode;
}

export function PageHeader({ title, right }: PageHeaderProps) {
  const navigation = useNavigation();

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" hitSlop={12} onPress={() => navigation.goBack()} style={styles.backButton}>
        <ChevronLeft color={colors.text} size={24} />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {title ?? ''}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center'
  },
  right: {
    width: 90,
    alignItems: 'flex-end'
  }
});
