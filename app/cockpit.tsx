import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const CockpitScreen = React.lazy(() => import('../components/screens/cockpit-screen'));

function RouteLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function CockpitRoute() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <CockpitScreen />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
