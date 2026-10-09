import type { EmailMessage } from './email-sender.js';
import { emailBrandFor, type EmailApplication } from './email-brand.js';

type TemplateInput = { to: string; token: string; baseUrl: string; displayName?: string };

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
  return value.replace(/[&<>\'"]/g, (character) => entities[character] ?? character);
}

function linkFor(baseUrl: string, token: string): string {
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

function renderBase(title: string, intro: string, actionLabel: string, url: string, expiry: string, displayName?: string, application: EmailApplication = 'usuario'): { html: string; text: string } {
  const brand = emailBrandFor(application);
  const safeName = displayName?.trim() ? escapeHtml(displayName.trim()) : 'ahí';
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeExpiry = escapeHtml(expiry);
  const safeUrl = escapeHtml(url);
  return {
    html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safeTitle} | ${brand.name}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .wit-shell { padding: 24px 12px !important; }
        .wit-card { border-radius: 12px !important; }
        .wit-card-inner { padding: 28px 24px !important; }
        .wit-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f1f4f2;color:#17211d;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:#f1f4f2;">
      <tr>
        <td class="wit-shell" align="center" style="padding:56px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="wit-card" style="width:100%;max-width:600px;border-collapse:separate;background:#ffffff;border:1px solid #e0e8e3;border-radius:16px;box-shadow:0 8px 28px rgba(23,33,29,0.06);">
            <tr>
              <td class="wit-card-inner" style="padding:40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:0 0 32px;"><span style="color:${brand.primary};font-size:26px;line-height:1;font-weight:800;letter-spacing:-1px;">WIT</span><span style="margin-left:10px;color:#69766f;font-size:12px;line-height:1;font-weight:700;letter-spacing:.3px;">${brand.name.replace('WIT ', '')}</span></td></tr>
                  <tr><td style="padding:0 0 10px;color:#17211d;font-size:16px;line-height:1.5;">Hola, ${safeName}.</td></tr>
                  <tr><td style="padding:0 0 16px;color:#17211d;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.4px;">${safeTitle}</td></tr>
                  <tr><td style="padding:0 0 28px;color:#526058;font-size:16px;line-height:1.65;">${safeIntro}</td></tr>
                  <tr><td style="padding:0 0 28px;"><a class="wit-button" href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:${brand.primary};border:1px solid ${brand.primary};border-radius:8px;color:#ffffff;font-size:16px;line-height:1.2;font-weight:700;text-decoration:none;">${safeActionLabel}</a></td></tr>
                  <tr><td style="padding:20px 0 0;border-top:1px solid #e8eeea;color:#69766f;font-size:13px;line-height:1.6;">Este enlace vence en ${safeExpiry} y solo puede utilizarse una vez. Si no solicitaste este correo, puedes ignorarlo con tranquilidad.</td></tr>
                  <tr><td style="padding:32px 0 0;color:#9aa59f;font-size:12px;line-height:1.5;">${brand.name} · Encuentra lo que necesitas, más cerca.</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: `Hola, ${displayName?.trim() || 'ahí'}.

${title}

${intro}

${actionLabel}: ${url}

Este enlace vence en ${expiry} y solo puede utilizarse una vez. Si no solicitaste este correo, puedes ignorarlo con tranquilidad.

${brand.name} · Encuentra lo que necesitas, más cerca.`,
  };
}

export function renderVerificationEmail(input: TemplateInput, application: EmailApplication = 'usuario'): EmailMessage {
  const url = linkFor(input.baseUrl, input.token);
  return { to: input.to, subject: 'Verifica tu correo electrónico de WIT', ...renderBase('Verifica tu correo electrónico', 'Confirma tu correo para completar la activación de tu cuenta de WIT.', 'Verificar correo', url, '24 horas', input.displayName, application) };
}

export function renderPasswordResetEmail(input: TemplateInput, application: EmailApplication = 'usuario'): EmailMessage {
  const url = linkFor(input.baseUrl, input.token);
  return { to: input.to, subject: 'Recupera tu contraseña de WIT', ...renderBase('Recupera tu contraseña', 'Solicitaste cambiar la contraseña de tu cuenta de WIT.', 'Restablecer contraseña', url, '30 minutos', input.displayName, application) };
}
