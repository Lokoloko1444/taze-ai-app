export type RiaAiBoundary = {
  mode: 'advisory-only';
  allowedCapabilities: readonly string[];
  blockedCapabilities: readonly string[];
};

export const RIA_AI_BOUNDARY: RiaAiBoundary = {
  mode: 'advisory-only',
  allowedCapabilities: [
    'explain',
    'advise',
    'warn',
    'propose_next_step',
    'signal_missing_info',
    'show_risk',
    'summarize',
    'translate',
  ],
  blockedCapabilities: [
    'decide',
    'change_memberships',
    'change_roles',
    'mutate_inventory',
    'finalize_invoice',
    'start_payment',
    'approve_payment',
    'change_stripe',
    'change_pricing',
    'change_tenant_access',
    'send_mail',
    'definitively_assign_driver',
    'simulate_customer_confirmation',
    'exceed_permissions',
  ],
} as const;
