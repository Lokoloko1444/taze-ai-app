import { RIA_AI_BOUNDARY } from 'lib/ai-boundary';

type BuildTenantAwareAiContextParams = {
  context?: unknown;
  tenantContext: unknown;
  transportGlobal: unknown;
};

export function buildTenantAwareAiContext({
  context,
  tenantContext,
  transportGlobal,
}: BuildTenantAwareAiContextParams) {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    return {
      ...(context as Record<string, unknown>),
      tenantContext,
      transportGlobal,
      riaBoundary: RIA_AI_BOUNDARY,
    };
  }

  return {
    inputContext: context,
    tenantContext,
    transportGlobal,
    riaBoundary: RIA_AI_BOUNDARY,
  };
}
