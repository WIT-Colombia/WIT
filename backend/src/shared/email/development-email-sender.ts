import type { EmailMessage, EmailSender } from './email-sender.js';

const messages: EmailMessage[] = [];

export class DevelopmentEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    messages.push(message);
    if (messages.length > 20) messages.shift();
  }
}

export function getDevelopmentEmailMessages(): readonly EmailMessage[] {
  return messages;
}

export function clearDevelopmentEmailMessages(): void {
  messages.length = 0;
}
