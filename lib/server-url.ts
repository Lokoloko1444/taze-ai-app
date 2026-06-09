import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DomainConfig } from 'lib/domain-config';
import { normalizeConfiguredServerBaseUrl, resolveNativeServerBaseUrl } from 'lib/server-url-policy';

export function getServerBaseUrl() {
  const envUrl = (process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_SERVER_URL ?? '').trim();
  if (envUrl) {
    return normalizeConfiguredServerBaseUrl(envUrl);
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return window.location.origin;
      }
    }
    return DomainConfig.apiOrigin;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra?.expoClient?.hostUri;
  return resolveNativeServerBaseUrl(hostUri);
}
