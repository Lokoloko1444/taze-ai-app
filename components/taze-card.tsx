import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

type TazeCardVariant = 'panel' | 'muted' | 'accent';

type Props = ViewProps & {
  variant?: TazeCardVariant;
  style?: StyleProp<ViewStyle>;
};

const variantStyles: Record<TazeCardVariant, ViewStyle> = {
  panel: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: 'rgba(15, 23, 42, 0.07)',
  },
  muted: {
    backgroundColor: '#f8fbff',
    borderColor: '#dbe7f2',
  },
  accent: {
    backgroundColor: '#f0fdfa',
    borderColor: '#bfece5',
  },
};

export function TazeCard({ variant = 'panel', style, ...props }: Props) {
  const { isCompact } = useResponsiveLayout();

  return (
    <View
      style={[
        {
          borderRadius: 26,
          borderWidth: 1,
          padding: isCompact ? 15 : 18,
          gap: isCompact ? 9 : 11,
          shadowColor: Brand.dark,
          shadowOpacity: 0.05,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 1,
          boxShadow: '0px 12px 30px rgba(15, 23, 42, 0.05)',
        },
        variantStyles[variant],
        style,
      ]}
      {...props}
    />
  );
}
