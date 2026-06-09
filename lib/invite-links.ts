import { DomainConfig } from 'lib/domain-config';

export function buildInviteLink(rawToken: string) {
  const token = rawToken.trim();
  return `${DomainConfig.appOrigin}/account?invite=${encodeURIComponent(token)}`;
}
