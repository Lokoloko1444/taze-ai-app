import { useRouter, type Href } from 'expo-router';
import { Alert, Platform, Share } from 'react-native';

import { type ReadinessRunbookPhase } from 'lib/readiness-runbook';

function buildReadinessFocusPath(phase: ReadinessRunbookPhase | null, taskId?: string | null) {
  const params = new URLSearchParams();
  if (phase) params.set('phase', phase);
  if (taskId) params.set('taskId', taskId);
  const query = params.toString();
  return (`/readiness${query ? `?${query}` : ''}`) as Href;
}

type ShareTextOptions = {
  message: string;
  title: string;
  clipboardMessage: string;
  failureMessage: string;
};

type ShareCsvOptions = {
  csv: string;
  title: string;
  webHintMessage: string;
  failureMessage: string;
};

export function useReadinessActions() {
  const router = useRouter();

  const openReadinessFocus = (phase: ReadinessRunbookPhase | null, taskId?: string | null) => {
    router.push(buildReadinessFocusPath(phase, taskId));
  };

  const clearRunbookFocus = () => {
    router.replace('/readiness' as Href);
  };

  const shareText = async ({ message, title, clipboardMessage, failureMessage }: ShareTextOptions) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        Alert.alert('Gekopieerd', clipboardMessage);
        return;
      } catch {
        // fall through
      }
    }

    try {
      await Share.share({ message, title });
    } catch {
      Alert.alert('Delen mislukt', failureMessage);
    }
  };

  const shareCsv = async ({ csv, title, webHintMessage, failureMessage }: ShareCsvOptions) => {
    if (Platform.OS === 'web') {
      const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      Alert.alert('CSV klaar', webHintMessage);
      return Share.share({ message: uri, title }).catch(() => {});
    }

    try {
      await Share.share({ message: csv, title });
    } catch {
      Alert.alert('Delen mislukt', failureMessage);
    }
  };

  return {
    clearRunbookFocus,
    openReadinessFocus,
    shareCsv,
    shareText,
  };
}
