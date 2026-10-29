import { AppError } from '../errors/app-error.js';
import type { EmailMessage, EmailSender } from './email-sender.js';

type ProviderErrorMetadata = {
  code?: string;
  type?: string;
};

function safeProviderValue(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
}

async function readProviderErrorMetadata(response: Response): Promise<ProviderErrorMetadata> {
  try {
    const rawBody = await response.text();
    if (rawBody.length > 16_384) return {};
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object') return {};
    const body = parsed as Record<string, unknown>;
    return {
      code: safeProviderValue(body.code ?? body.name),
      type: safeProviderValue(body.type ?? body.name),
    };
  } catch {
    return {};
  }
}

export class ResendEmailSender implements EmailSender {
  constructor(private readonly apiKey: string, private readonly apiUrl: string, private readonly from: string) {}

  async send(message: EmailMessage): Promise<void> {
    const payload = { from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html };
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
    if (message.idempotencyKey) headers['Idempotency-Key'] = message.idempotencyKey;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(this.apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        if (response.ok) return;
        const metadata = await readProviderErrorMetadata(response);
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!retryable || attempt === maxAttempts) {
          const details = { providerStatus: response.status, providerCode: metadata.code, providerType: metadata.type, ...(message.eventType ? { eventType: message.eventType } : {}) };
          console.error('Resend email delivery failed', details);
          throw new AppError(503, 'EMAIL_DELIVERY_FAILED', 'No se pudo enviar el correo.');
        }
        const retryAfter = Number(response.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 250 * (2 ** (attempt - 1));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (attempt === maxAttempts) {
          console.error('Resend email request failed', { ...(message.eventType ? { eventType: message.eventType } : {}), attempt });
          throw new AppError(503, 'EMAIL_DELIVERY_FAILED', 'No se pudo enviar el correo.');
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** (attempt - 1))));
      }
    }
  }
}
