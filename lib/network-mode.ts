import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';

export type NetworkMode = 'online' | 'offline' | 'bluetooth';

export function useNetworkMode() {
  const [isConnected, setIsConnected] = useState(true);
  const [mode, setMode] = useState<NetworkMode>('online');
  const [bluetoothActive, setBluetoothActive] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      setIsConnected(connected);

      if (connected) {
        setBluetoothActive(false);
        setMode('online');
        return;
      }

      // When the device has no internet, switch into the offline/Bluetooth fallback mode.
      setBluetoothActive(true);
      setMode('bluetooth');
    });

    return () => unsubscribe();
  }, []);

  const ensureBluetoothFallback = useCallback(async () => {
    if (isConnected) return;
    // TODO: Replace this stub with a real Bluetooth/peer-to-peer fallback implementation.
    setBluetoothActive(true);
    setMode('bluetooth');
  }, [isConnected]);

  const disableBluetoothFallback = useCallback(async () => {
    const nextMode: NetworkMode = isConnected ? 'online' : 'offline';
    setBluetoothActive(false);
    setMode(nextMode);
  }, [isConnected]);

  return {
    isConnected,
    mode,
    bluetoothActive,
    ensureBluetoothFallback,
    disableBluetoothFallback,
  } as const;
}
