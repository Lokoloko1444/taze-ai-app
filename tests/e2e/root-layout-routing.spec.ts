import { expect, test } from '@playwright/test';

import { getHostSurface, getOriginForHostSurface } from 'lib/domain-config';
import { getHostAccessLabel, resolveHostAccess } from 'lib/host-access';
import { getPageSeo, getPageSeoUrl } from 'lib/page-seo';
import { resolveRootLayoutSurface } from 'lib/root-layout-routing';

test('ai host gets its own surface and origin', () => {
  expect(getHostSurface('ai.taze.to')).toBe('ai');
  expect(getOriginForHostSurface('ai')).toBe('https://ai.taze.to');
  expect(getHostAccessLabel('ai')).toBe('ai.taze.to');
});

test('expo preview host stays in the app surface instead of the unknown boundary', () => {
  expect(getHostSurface('taze-app.expo.app')).toBe('app');
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'app',
      pathname: '/',
      hostname: 'taze-app.expo.app',
    })
  ).toBe('app-protected');
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'app',
      pathname: '/account',
      hostname: 'taze-app.expo.app',
    })
  ).toBe('app-protected');
});

test('ai host resolves to the ai protected surface and AI SEO', () => {
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'ai',
      pathname: '/ai',
      hostname: 'ai.taze.to',
    })
  ).toBe('ai-protected');
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'ai',
      pathname: '/ai',
      hostname: 'ai.taze.to',
    })
  ).not.toBe('demo-website');
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'ai',
      pathname: '/ai',
      hostname: 'ai.taze.to',
    })
  ).not.toBe('scan-protected');
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'ai',
      pathname: '/ai',
      hostname: 'ai.taze.to',
    })
  ).not.toBe('transport-protected');
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'ai',
      pathname: '/ai',
      hostname: 'ai.taze.to',
    })
  ).not.toBe('invoice-protected');
  expect(
    resolveRootLayoutSurface({
      hostSurface: 'ai',
      pathname: '/ai',
      hostname: 'ai.taze.to',
    })
  ).not.toBe('admin-protected');

  const seo = getPageSeo('/ai', 'ai', null);
  expect(seo.title).toBe('Taze | RIA / AI advieslijn');
  expect(seo.description).toBe('Read-only advies binnen bevoegdheid. Menselijke bevestiging blijft vereist.');
  expect(seo.robots).toBe('noindex,nofollow');
  expect(getPageSeoUrl('/ai', 'ai', null)).toBe('https://ai.taze.to/ai');
});

test('ai host access is protected and AI-specific', () => {
  const loadingDecision = resolveHostAccess({
    hostSurface: 'ai',
    pathname: '/',
    ready: false,
    email: null,
    role: null,
    activeMembershipStatus: null,
    permissions: [],
    functions: [],
  });

  expect(loadingDecision.status).toBe('loading');
  expect(loadingDecision.statusCode).toBe(null);

  const loginDecision = resolveHostAccess({
    hostSurface: 'ai',
    pathname: '/',
    ready: true,
    email: null,
    role: null,
    activeMembershipStatus: null,
    permissions: [],
    functions: [],
  });

  expect(loginDecision.status).toBe('unauthorized');
  expect(loginDecision.statusCode).toBe(401);
  expect(loginDecision.title).toBe('RIA / AI advieslijn');
  expect(loginDecision.message).toContain('read-only AI/RIA advieslijn');

  const allowedDecision = resolveHostAccess({
    hostSurface: 'ai',
    pathname: '/ai',
    ready: true,
    email: 'manager@taze.to',
    role: 'MANAGER',
    activeMembershipStatus: 'ACTIVE',
    permissions: ['invoice.manage'],
    functions: ['ADMIN'],
  });

  expect(allowedDecision.status).toBe('allow');
  expect(allowedDecision.reason).toBe('ready');
});
