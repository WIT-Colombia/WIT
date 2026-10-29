export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Stable key for provider-side deduplication during retries. */
  idempotencyKey?: string;
  eventType?: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
