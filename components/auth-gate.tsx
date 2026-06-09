import React, { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';

import { HostAccessScreen } from 'components/host-access-screen';
import { useAuth } from 'lib/auth-context';
import { type HostSurface } from 'lib/domain-config';
import { resolveHostAccess } from 'lib/host-access';
import { resolveAppLanguage } from 'lib/i18n';

type Props = {
  hostSurface: HostSurface;
  children: React.ReactNode;
};

export function AuthGate({ hostSurface, children }: Props) {
  const auth = useAuth();
  const pathname = usePathname();
  const [loadingExpired, setLoadingExpired] = useState(false);
  const language = resolveAppLanguage();

  useEffect(() => {
    if (auth.ready) {
      setLoadingExpired(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingExpired(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [auth.ready]);

  const readyOrTimedOut = auth.ready || loadingExpired;
  const decision = resolveHostAccess({
    hostSurface,
    pathname,
    ready: readyOrTimedOut,
    email: auth.email,
    role: auth.role,
    activeMembershipStatus: auth.activeMembership?.status ?? null,
    permissions: auth.permissions,
    functions: auth.functions,
    language,
  });

  if (decision.status === 'loading') {
    return <HostAccessScreen hostSurface={hostSurface} decision={decision} language={language} />;
  }

  if (decision.status === 'unauthorized' || decision.status === 'forbidden') {
    return <HostAccessScreen hostSurface={hostSurface} decision={decision} language={language} />;
  }

  return <>{children}</>;
}
