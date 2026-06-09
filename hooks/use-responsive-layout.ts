import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

const SSR_DEFAULT_WIDTH = 1440;

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const resolvedWidth = hydrated ? width : SSR_DEFAULT_WIDTH;
  const isCompact = resolvedWidth < 520;
  const isTablet = resolvedWidth >= 520 && resolvedWidth < 960;
  const isWide = resolvedWidth >= 960;

  return {
    width: resolvedWidth,
    isCompact,
    isTablet,
    isWide,
    pagePadding: isCompact ? 16 : isTablet ? 20 : 24,
    pageMaxWidth: isWide ? 1120 : 1080,
  } as const;
}
