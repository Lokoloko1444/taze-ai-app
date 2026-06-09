import { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DemoProductWorkflowBlock } from 'components/demo-product-workflow-block';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

type SectionKey = 'proof';

export function DemoExperiencePage() {
  const { isCompact } = useResponsiveLayout();
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionY = useRef<Record<SectionKey, number>>({
    proof: 0,
  });

  const registerLayout = useCallback((key: SectionKey) => {
    return (event: { nativeEvent: { layout: { y: number } } }) => {
      sectionY.current[key] = event.nativeEvent.layout.y;
    };
  }, []);

  const scrollToSection = useCallback((key: SectionKey) => {
    const y = sectionY.current[key] ?? 0;
    scrollRef.current?.scrollTo({ y, animated: true });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.shell, isCompact && styles.shellCompact]}
      showsVerticalScrollIndicator={false}>
      <View onLayout={registerLayout('proof')} style={styles.sectionSpacing}>
        <DemoProductWorkflowBlock onStartDemo={() => scrollToSection('proof')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    padding: 16,
    gap: 14,
  },
  shellCompact: {
    padding: 14,
  },
  sectionSpacing: {
    gap: 10,
  },
});
