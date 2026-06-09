function envTruthy(value: string | undefined) {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function isInternalToolsEnabled() {
  return envTruthy(process.env.EXPO_PUBLIC_ENABLE_INTERNAL_TOOLS);
}

