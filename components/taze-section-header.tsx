import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { ThemedText } from 'components/themed-text';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

type Props = {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: Parameters<typeof TazeBadge>[0]['tone'];
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function TazeSectionHeader({ title, subtitle, badge, badgeTone = 'primary', action, style }: Props) {
  const { isCompact } = useResponsiveLayout();

  return (
    <View style={[styles.wrap, isCompact && styles.wrapCompact, style]}>
      <View style={styles.copy}>
        {badge ? <TazeBadge label={badge} tone={badgeTone} /> : null}
        <ThemedText type="subtitle">{title}</ThemedText>
        {subtitle ? <ThemedText>{subtitle}</ThemedText> : null}
      </View>
      {action ? <View style={[styles.action, isCompact && styles.actionCompact]}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  copy: {
    flex: 1,
    minWidth: 220,
    gap: 5,
  },
  action: {
    alignSelf: 'flex-start',
  },
  wrapCompact: {
    alignItems: 'stretch',
  },
  actionCompact: {
    width: '100%',
  },
});
