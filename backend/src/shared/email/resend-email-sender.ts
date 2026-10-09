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
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!response.ok) {
      const metadata = await readProviderErrorMetadata(response);
      console.error('Resend email delivery failed', {
        providerStatus: response.status,
        providerCode: metadata.code,
        providerType: metadata.type,
      });
      throw new AppError(503, 'EMAIL_DELIVERY_FAILED', 'No se pudo enviar el correo.');
    }
  }
}
