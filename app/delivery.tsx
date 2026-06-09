import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const DeliveryScreen = React.lazy(() => import('../components/screens/delivery-screen'));

function RouteLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function DeliveryRoute() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <DeliveryScreen />
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
