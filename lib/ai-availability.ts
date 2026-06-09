import { t, type AppLanguage, type TranslationKey } from 'lib/i18n';

const aiAvailabilityMessageKeys: Record<string, TranslationKey> = {
  openai_not_configured: 'ai.availability.notConfigured',
  openai_auth_error: 'ai.availability.authError',
  openai_rate_limited: 'ai.availability.rateLimited',
  openai_unavailable: 'ai.availability.unavailable',
  question_too_short: 'ai.availability.questionTooShort',
};

export function isRealAiDisabledError(errorCode: string) {
  return errorCode === 'openai_not_configured' || errorCode === 'openai_auth_error' || errorCode === 'openai_unavailable';
}

export function getRealAiUnavailableMessage(errorCode: string, language: AppLanguage = 'nl') {
  return t(aiAvailabilityMessageKeys[errorCode] ?? 'ai.availability.default', language);
}
