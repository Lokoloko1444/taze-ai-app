import { StyleSheet, View } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { ThemedText } from 'components/themed-text';

type ItemAction = {
  icon: NonNullable<ComponentProps<typeof TazeButton>['icon']>;
  label: string;
  variant?: 'ghost' | 'secondary';
  onPress: () => void;
};

type Props = {
  title: string;
  badgeLabel?: string;
  badgeTone?: 'accent' | 'danger' | 'info' | 'neutral' | 'success' | 'warning';
  meta?: string;
  extraMeta?: string[];
  actions?: ItemAction[];
  children?: ReactNode;
};

export function ReadinessItemCard({
  title,
  badgeLabel,
  badgeTone = 'neutral',
  meta,
  extraMeta = [],
  actions = [],
  children,
}: Props) {
  return (
    <TazeCard variant="panel" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
        {badgeLabel ? <TazeBadge label={badgeLabel} tone={badgeTone} /> : null}
      </View>
      {meta ? <ThemedText style={styles.meta}>{meta}</ThemedText> : null}
      {extraMeta.map((line) => (
        <ThemedText key={line} style={styles.extraMeta}>
          {line}
        </ThemedText>
      ))}
      {children}
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <TazeButton
              key={action.label}
              icon={action.icon}
              label={action.label}
              variant={action.variant ?? 'ghost'}
              onPress={action.onPress}
            />
          ))}
        </View>
      ) : null}
    </TazeCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  meta: {
    marginTop: 2,
    color: '#475569',
  },
  extraMeta: {
    marginTop: 4,
    color: '#64748b',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
});
