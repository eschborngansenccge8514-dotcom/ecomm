import { Resend } from 'resend';

const isNode = typeof process !== 'undefined';
const resendApiKey = isNode ? process.env.RESEND_API_KEY : undefined;
const resendFromDomain = isNode ? process.env.RESEND_FROM_DOMAIN : undefined;

if (!resendApiKey) {
  // We allow the package to be loaded without an API key for build time or local preview
  // but if it's used to send, we should throw a meaningful error.
  console.warn('[resend] RESEND_API_KEY is not set');
}

export const resend = new Resend(resendApiKey || 're_not_set');

const FROM_DOMAIN = resendFromDomain || 'resend.dev';
const FROM_PREFIX = FROM_DOMAIN === 'resend.dev' ? 'onboarding' : 'orders';

export const FROM_ADDRESSES = {
  transactional: `Hyperlocal <${FROM_PREFIX}@${FROM_DOMAIN}>`,
  merchant:      `Merchant Hub <merchant@${FROM_DOMAIN}>`,
  support:       `Support <support@${FROM_DOMAIN}>`,
  noreply:       `No Reply <noreply@${FROM_DOMAIN}>`,
} as const;
