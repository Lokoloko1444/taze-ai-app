import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const TraceScreen = React.lazy(() => import('../trace'));

function RouteLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function TraceTabRoute() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <TraceScreen />
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
