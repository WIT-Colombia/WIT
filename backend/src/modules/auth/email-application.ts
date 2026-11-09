import type { EmailApplication } from '../../shared/email/email-brand.js';

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch { return null; }
}

/** A trusted Business origin gets Business-branded emails; never trust a client-supplied app label. */
export function emailApplicationForOrigin(
  requestOrigin: string | undefined,
  businessOrigin: string,
  trustedOrigins: readonly string[],
): EmailApplication {
  const requested = origin(requestOrigin);
  const authorizedBusiness = origin(businessOrigin);
  const trusted = new Set(trustedOrigins.map(x => origin(x)).filter((v): v is string => v !== null));
  return requested && requested === authorizedBusiness && trusted.has(requested) ? 'negocios' : 'usuario';
}
