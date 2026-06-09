import { expect, test } from '@playwright/test';

import {
  buildOAuthCallbackUrl,
  buildOAuthLoginRequest,
  getAuthCallbackDestination,
  getMissingAuthCallbackMessage,
  hasAuthCallbackFragment,
  hasAuthCallbackSessionData,
  parseAuthCallbackHash,
} from 'lib/auth-redirect';

test('oauth login request uses google provider and the web callback url', () => {
  const request = buildOAuthLoginRequest('google', 'invite-token-123', 'https://taze-app.expo.app');

  expect(request.provider).toBe('google');
  expect(request.options.redirectTo).toBe('https://app.taze.to/auth/callback?invite=invite-token-123');
  expect(request.options.queryParams).toEqual({ prompt: 'select_account' });
});

test('apple login request keeps the callback and omits the prompt override', () => {
  const request = buildOAuthLoginRequest('apple', '', 'https://taze-app.expo.app');

  expect(request.provider).toBe('apple');
  expect(request.options.redirectTo).toBe('https://app.taze.to/auth/callback');
  expect(request.options.queryParams).toBeUndefined();
});

test('callback helper keeps invite tokens on the current app origin', () => {
  expect(buildOAuthCallbackUrl('invite-token-123', 'https://taze-app.expo.app')).toBe(
    'https://app.taze.to/auth/callback?invite=invite-token-123'
  );
  expect(buildOAuthCallbackUrl('', 'https://taze-app.expo.app')).toBe('https://app.taze.to/auth/callback');
  expect(buildOAuthCallbackUrl('', 'https://app.taze.to')).toBe('https://app.taze.to/auth/callback');
  expect(buildOAuthCallbackUrl('', 'https://legacy.example.com')).toBe('https://legacy.example.com/auth/callback');
  expect(buildOAuthCallbackUrl('', 'https://app.taze.to')).toBe(
    'https://app.taze.to/auth/callback'
  );
});

test('oauth callback with access_token is not treated as a missing code case', () => {
  const hash = parseAuthCallbackHash('#access_token=token-123&refresh_token=refresh-456');

  expect(hash.accessToken).toBe('token-123');
  expect(hash.refreshToken).toBe('refresh-456');
  expect(hasAuthCallbackFragment(hash)).toBe(true);
  expect(
    hasAuthCallbackSessionData({
      code: '',
      hash,
      sessionPresent: false,
    })
  ).toBe(true);
  expect(getMissingAuthCallbackMessage(true)).toBe('De aanmeldsessie kon niet worden voltooid. Probeer opnieuw.');
});

test('invite-less callback without any oauth payload still fails clearly', () => {
  const hash = parseAuthCallbackHash('');

  expect(hash.accessToken).toBe('');
  expect(hash.refreshToken).toBe('');
  expect(hasAuthCallbackFragment(hash)).toBe(false);
  expect(
    hasAuthCallbackSessionData({
      code: '',
      hash,
      sessionPresent: false,
    })
  ).toBe(false);
  expect(getMissingAuthCallbackMessage(false)).toBe('Geen aanmeldcode of sessie ontvangen. Open de login opnieuw.');
});

test('invite token stays on the account route after callback success', () => {
  expect(getAuthCallbackDestination('invite-token-123')).toBe('/account?invite=invite-token-123');
  expect(getAuthCallbackDestination('')).toBe('/account');
});
