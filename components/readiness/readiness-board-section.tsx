import { StyleSheet, View } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';

import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeSectionHeader } from 'components/taze-section-header';

type SectionAction = {
  icon: NonNullable<ComponentProps<typeof TazeButton>['icon']>;
  label: string;
  variant?: 'secondary' | 'ghost';
  onPress: () => void;
};

type Props = {
  title: string;
  description: string;
  actions?: (SectionAction | null | undefined | false)[];
  children: ReactNode;
};

export function ReadinessBoardSection({ title, description, actions = [], children }: Props) {
  const visibleActions = actions.filter(Boolean) as SectionAction[];

  return (
    <TazeCard variant="muted">
      <TazeSectionHeader title={title} subtitle={description} />
      {visibleActions.length > 0 ? (
        <View style={styles.actionRow}>
          {visibleActions.map((action) => (
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
      {children}
    </TazeCard>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
});
