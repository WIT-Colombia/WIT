import type { EmailMessage } from './email-sender.js';
import { emailBrandFor, type EmailApplication } from './email-brand.js';
import { renderBrandedEmailLayout } from './branded-email-layout.js';
import { EMAIL_ACTION_LINK_TTL_MINUTES } from './email-link-expiration.js';

type TemplateInput = { to: string; token: string; baseUrl: string; displayName?: string; logoUrl?: string };
type NoticeInput = { to: string; displayName?: string; application?: EmailApplication; logoUrl?: string };

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
  return value.replace(/[&<>\'"]/g, (character) => entities[character] ?? character);
}

function linkFor(baseUrl: string, token: string): string {
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

export function renderVerificationEmail(input: TemplateInput, application: EmailApplication = 'usuario'): EmailMessage {
 const url = linkFor(input.baseUrl,input.token);
 const safeUrl = escapeHtml(url);
 const safeName = input.displayName?.trim() ? escapeHtml(input.displayName.trim()) : 'ahí';
 const brandName = application === 'negocios' ? 'XAMUKO Business' : 'XAMUKO';
 const html = String.raw`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Verifica tu correo electrónico | XAMUKO</title>
  <style>
    @media only screen and (max-width: 660px) {
      .mail-shell { padding: 12px 8px !important; }
      .mail-card { width:100% !important; border-radius: 15px !important; }
      .mail-body { padding: 0 20px !important; }
      .greeting { font-size: 21px !important; padding-top: 15px !important; }
      .mail-grid { width:100% !important; }
      .hero-col { display:block !important; width:100% !important; max-width:100% !important; text-align:center !important; }
      .hero-art { width:190px !important; max-width:70% !important; height:auto !important; margin:auto !important; }
      .hero-divider { display:none !important; }
      .hero-copy { display:block !important; width:100% !important; padding: 10px 0 0 !important; text-align:center !important; }
      .hero-title { font-size:30px !important; line-height:1.08 !important; }
      .hero-description { font-size:16px !important; line-height:1.45 !important; }
      .mail-btn { width:100% !important; text-align:center !important; }
      .mail-btn-text { font-size:19px !important; }
      .notice { padding:14px 12px !important; }
      .notice-icon { width:48px !important; }
      .notice-text { font-size:13px !important; line-height:1.5 !important; }
      .notice-icon-img { width:44px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f8f7fc;color:#080a27;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Confirma tu correo electrónico en XAMUKO. El enlace es válido por ${EMAIL_ACTION_LINK_TTL_MINUTES} minutos.</div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;background:#f8f7fc;">
    <tr><td class="mail-shell" align="center" style="padding:24px 12px 36px;">
      <table role="presentation" class="mail-card" border="0" cellpadding="0" cellspacing="0" width="760" style="width:100%;max-width:760px;border:1px solid #8337ff;border-radius:18px;border-spacing:0;background:#ffffff;box-shadow:0 12px 22px rgba(35,21,95,.10);">
        <tr><td style="padding:0;line-height:0;font-size:0;background:#ffffff;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
            <tr>
              <td align="left" valign="middle" width="58%" style="width:58%;padding:18px 0 12px 30px;background:#ffffff;">
                <img class="brand-header-logo" src="https://xamuko.com/brand/xamuko-symbol.jpg" alt="XAMUKO" width="64" height="64" style="display:block;width:64px;height:64px;max-width:100%;object-fit:contain;border:0;outline:none;text-decoration:none;background:#fff;border-radius:10px;">
              </td>
              <td valign="top" width="42%" height="110" bgcolor="#8b4af5" style="width:42%;height:110px;background-color:#8b4af5;background-image:linear-gradient(135deg,#e2bbfa 0%,#aa70fa 45%,#3885f7 100%);border-bottom-left-radius:110px;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="mail-body" style="padding:0 46px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr><td class="greeting" style="padding:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:31px;line-height:1.35;font-weight:400;letter-spacing:-.7px;color:#090c28;">
              Hola, <strong style="color:#5b07bf;font-weight:800;">{{nombre}}</strong>.
            </td></tr>
            <tr><td style="padding:9px 0 21px;"><div style="width:54px;height:5px;background:#670bd1;border-radius:4px;"></div></td></tr>
          </table>
          <table role="presentation" class="mail-grid" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;table-layout:fixed;">
            <tr>
              <td class="hero-col" width="36%" align="center" valign="middle" style="width:36%;padding:0 20px 0 0;">
                <img class="hero-art" src="{{asset_base_url}}/ilustracion-correo.png" width="253" alt="Ilustración de un sobre con una verificación confirmada" style="display:block;width:253px;max-width:100%;height:auto;border:0;">
              </td>
              <td class="hero-divider" width="1" style="width:1px;border-left:1px solid #a59fbe;font-size:0;line-height:0;">&nbsp;</td>
              <td class="hero-copy" align="left" valign="middle" style="padding:0 0 0 26px;">
                <h1 class="hero-title" style="margin:0 0 12px;color:#060728;font-family:Arial,Helvetica,sans-serif;font-size:41px;font-weight:800;line-height:1.07;letter-spacing:-1px;">Verifica tu correo<br><span style="color:#5d07bf;">electrónico</span></h1>
                <p class="hero-description" style="margin:0 0 18px;color:#383663;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.4;letter-spacing:-.25px;">Confirma tu correo para completar la activación de tu cuenta de {{app_name}}.</p>
                <table role="presentation" class="mail-btn" border="0" cellspacing="0" cellpadding="0" width="305" style="width:305px;max-width:100%;border-collapse:separate;">
                  <tr><td align="center" bgcolor="#750cc9" style="border-radius:15px;background-color:#7206cb;background-image:linear-gradient(180deg,#bf53ff 0%,#810bd1 47%,#5202a9 100%);">
                    <a href="{{verification_url}}" target="_blank" style="display:block;padding:12px 8px;text-decoration:none;color:#ffffff;font-size:25px;font-weight:800;line-height:1.2;white-space:nowrap;border-radius:15px;">
                      <img src="{{asset_base_url}}/icono-sobre-blanco.png" alt="" width="32" height="26" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0;"> <span class="mail-btn-text" style="vertical-align:middle;color:#ffffff;">Verificar correo</span>
                    </a>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
          <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="width:100%;border-collapse:separate;margin-top:22px;">
            <tr><td class="notice" bgcolor="#f0eaff" style="padding:13px 19px;border-radius:15px;background:#f1ebff;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td class="notice-icon" width="86" align="center" valign="middle" style="width:86px;padding-right:12px;">
                    <img class="notice-icon-img" src="{{asset_base_url}}/icono-reloj.png" alt="" width="68" style="display:block;width:68px;max-width:100%;height:auto;border:0;">
                  </td>
                  <td style="border-left:2px solid #6a13d3;padding:2px 0 2px 14px;" valign="middle">
                    <p class="notice-text" style="margin:0 0 4px;color:#090a28;font-size:18px;line-height:1.4;">Este enlace vence en <strong style="color:#6207c9;font-weight:800;">${EMAIL_ACTION_LINK_TTL_MINUTES} minutos</strong> y solo puede utilizarse una vez.</p>
                    <p class="notice-text" style="margin:0;color:#34345d;font-size:17px;line-height:1.45;">Si no solicitaste este correo, puedes ignorarlo con tranquilidad.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" bgcolor="#7B3FFB" style="padding:12px 0;background:#7B3FFB;background-image:linear-gradient(110deg,#7B3FFB 0%,#2563EB 100%);border-radius:0 0 17px 17px;"><img src="https://xamuko.com/brand/xamuko-symbol.jpg" alt="XAMUKO" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:contain;background:#fff;border:0;border-radius:8px;"></td></tr>
      </table>
      <p style="margin:14px 0 0;color:#71718b;font-size:11px;line-height:1.6;">Correo automático de XAMUKO. Por favor, no respondas a este mensaje.</p>
    </td></tr>
  </table>
</body>
</html>`
  .replaceAll('{{asset_base_url}}', 'https://xamuko.com/assets/email/verify')
  .replaceAll('{{nombre}}', safeName)
  .replaceAll('{{app_name}}', escapeHtml(brandName))
  .replaceAll('{{verification_url}}', safeUrl);
 const text = `Hola, ${input.displayName?.trim() || 'ahí'}.

Verifica tu correo electrónico

Confirma tu correo para completar la activación de tu cuenta de ${brandName}.

Verificar correo: ${url}

Este enlace vence en ${EMAIL_ACTION_LINK_TTL_MINUTES} minutos y solo puede utilizarse una vez. Si no solicitaste este correo, puedes ignorarlo con tranquilidad.

XAMUKO · Lo que necesitas, está más cerca.`;
 return {to:input.to,subject:`Verifica tu correo electrónico de ${brandName}`,html,text};
}

export function renderPasswordResetEmail(input: TemplateInput, application: EmailApplication = 'usuario'): EmailMessage {
  const url = linkFor(input.baseUrl, input.token);
  const brand = emailBrandFor(application);
  const title = 'Recupera tu contraseña';
  const intro = `Solicitaste cambiar la contraseña de tu cuenta de ${brand.name}.`;
  const notice = `Este enlace vence en ${EMAIL_ACTION_LINK_TTL_MINUTES} minutos y solo puede utilizarse una vez.`;
  const footnote = 'Si no solicitaste este correo, puedes ignorarlo con tranquilidad.';
  const html = renderBrandedEmailLayout({
    kind: 'password-reset', brandName: brand.name, displayName: input.displayName, title,
    description: intro, notice, footnote, logoUrl: input.logoUrl,
    action: { label: 'Restablecer contraseña', url },
  });
  const text = `Hola, ${input.displayName?.trim() || 'ahí'}.

${title}

${intro}

Restablecer contraseña: ${url}

${notice} ${footnote}

${brand.name} · Lo que necesitas, está más cerca.`;
  return { to: input.to, subject: `Recupera tu contraseña de ${brand.name}`, html, text };
}

function renderNotice(input: NoticeInput, title: string, intro: string, subject: string, kind: 'welcome' | 'security'): EmailMessage {
  const application = input.application ?? 'usuario';
  const brand = emailBrandFor(application);
  const isSecurity = kind === 'security';
  const notice = isSecurity ? 'Mantén el control de la seguridad de tu cuenta.' : 'Tu cuenta ya está creada.';
  const footnote = isSecurity
    ? 'Si no reconoces esta actividad, cambia tu contraseña desde la aplicación y contacta a soporte.'
    : `Ya puedes iniciar sesión en ${brand.name}.`;
  const html = renderBrandedEmailLayout({
    kind, brandName: brand.name, displayName: input.displayName, title,
    description: intro, notice, footnote, logoUrl: input.logoUrl,
  });
  const text = `Hola, ${input.displayName?.trim() || 'ahí'}.

${title}

${intro}

${notice}
${footnote}

${brand.name} · Lo que necesitas, está más cerca.`;
  return { to: input.to, subject: `${subject} · ${brand.name}`, html, text };
}

export function renderWelcomeEmail(input: NoticeInput): EmailMessage {
  return renderNotice(input, 'Te damos la bienvenida a XAMUKO', 'Tu correo está verificado y tu cuenta está activa. Ya puedes empezar a descubrir lo que necesitas cerca.', 'Bienvenido', 'welcome');
}

export function renderSecurityNotificationEmail(input: NoticeInput, action = 'Se actualizó la seguridad de tu cuenta'): EmailMessage {
  return renderNotice(input, action, 'Te avisamos de este cambio para que puedas mantener el control de tu cuenta.', 'Aviso de seguridad', 'security');
}
