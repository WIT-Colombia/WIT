import type { EmailMessage } from './email-sender.js';
import { emailBrandFor, type EmailApplication } from './email-brand.js';

type TemplateInput = { to: string; token: string; baseUrl: string; displayName?: string; logoUrl?: string };
type NoticeInput = { to: string; displayName?: string; application?: EmailApplication };

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
  return value.replace(/[&<>\'"]/g, (character) => entities[character] ?? character);
}

function linkFor(baseUrl: string, token: string): string {
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

function renderBase(title: string, intro: string, actionLabel: string, url: string, expiry: string, displayName?: string, application: EmailApplication = 'usuario', logoUrl?: string): { html: string; text: string } {
  const brand = emailBrandFor(application);
  const isXamuko = application === 'usuario';
  const buttonBackground = isXamuko ? 'linear-gradient(110deg,#7B3FFB 0%,#2563EB 100%)' : brand.primary;
  const tagline = isXamuko ? 'Lo que necesitas, está más cerca.' : 'Encuentra lo que necesitas, más cerca.';
  const safeName = displayName?.trim() ? escapeHtml(displayName.trim()) : 'ahí';
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeExpiry = escapeHtml(expiry);
  const safeUrl = escapeHtml(url);
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : '';
  const logoMarkup = isXamuko && safeLogoUrl
    ? `<img src="${safeLogoUrl}" alt="${brand.name}" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">`
    : `<span style="color:${brand.primary};font-size:26px;line-height:1;font-weight:800;letter-spacing:-1px;">${brand.name}</span>`;
  return {
    html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safeTitle} | ${brand.name}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .mail-shell { padding: 24px 12px !important; }
        .mail-card { border-radius: 12px !important; }
        .mail-card-inner { padding: 28px 24px !important; }
        .mail-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f1f4f2;color:#17211d;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:#f1f4f2;">
      <tr>
        <td class="mail-shell" align="center" style="padding:56px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="mail-card" style="width:100%;max-width:600px;border-collapse:separate;background:#ffffff;border:1px solid #e0e8e3;border-radius:16px;box-shadow:0 8px 28px rgba(23,33,29,0.06);">
            <tr>
              <td class="mail-card-inner" style="padding:40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:0 0 32px;">${logoMarkup}<span style="display:block;margin-top:9px;color:#64748B;font-size:12px;line-height:1.3;font-weight:600;letter-spacing:.1px;">${tagline}</span></td></tr>
                  <tr><td style="padding:0 0 10px;color:#17211d;font-size:16px;line-height:1.5;">Hola, ${safeName}.</td></tr>
                  <tr><td style="padding:0 0 16px;color:#17211d;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.4px;">${safeTitle}</td></tr>
                  <tr><td style="padding:0 0 28px;color:#526058;font-size:16px;line-height:1.65;">${safeIntro}</td></tr>
                  <tr><td style="padding:0 0 28px;"><a class="mail-button" href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:${buttonBackground};border:1px solid ${brand.primary};border-radius:8px;color:#ffffff;font-size:16px;line-height:1.2;font-weight:700;text-decoration:none;">${safeActionLabel}</a></td></tr>
                  <tr><td style="padding:20px 0 0;border-top:1px solid #e8eeea;color:#69766f;font-size:13px;line-height:1.6;">Este enlace vence en ${safeExpiry} y solo puede utilizarse una vez. Si no solicitaste este correo, puedes ignorarlo con tranquilidad.</td></tr>
                  <tr><td style="padding:32px 0 0;color:#9aa59f;font-size:12px;line-height:1.5;">${brand.name} · ${tagline}</td></tr>
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

${brand.name} · ${tagline}`,
  };
}

export function renderVerificationEmail(input: TemplateInput, application: EmailApplication = 'usuario'): EmailMessage {
 const brand = emailBrandFor(application);
 const url = linkFor(input.baseUrl,input.token);
 const safeUrl = escapeHtml(url);
 const safeName = input.displayName?.trim() ? escapeHtml(input.displayName.trim()) : 'ahí';
 const brandName = application === 'negocios' ? 'XAMUKO Business' : 'XAMUKO';
 const logo = input.logoUrl
  ? `<img src="${escapeHtml(input.logoUrl)}" alt="XAMUKO" width="230" style="display:block;width:230px;max-width:100%;height:auto;border:0;">`
  : `<strong style="font-family:Arial,Helvetica,sans-serif;color:#090a27;font-size:38px;font-weight:800;letter-spacing:-1.5px;">XAMUKO</strong>`;
 const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifica tu correo | XAMUKO</title>
<style>@media only screen and (max-width:640px){.email-shell{padding:10px 7px!important}.email-card{width:100%!important}.email-content{padding:12px 20px 20px!important}.greeting{font-size:24px!important}.hero-left{display:block!important;width:100%!important;padding:5px 0!important;text-align:center!important}.hero-right{display:block!important;width:100%!important;padding:10px 0!important;text-align:center!important}.hero-line{display:none!important}.hero-title{font-size:32px!important}.hero-desc{font-size:17px!important}.cta-wrap{width:100%!important}.notice-text{font-size:14px!important}.notice-icon{width:52px!important}.email-footer{padding:20px 12px!important}}</style></head>
<body style="margin:0;padding:0;background:#f9f7fe;color:#0b0b2b;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Confirma tu correo en XAMUKO. Enlace de verificación: 15 minutos.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f9f7fe;"><tr><td align="center" class="email-shell" style="padding:24px 12px 36px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="email-card" width="760" style="width:100%;max-width:760px;border:1px solid #8735fc;border-radius:18px;box-shadow:0 12px 24px rgba(40,18,96,.1);border-collapse:separate;background:#fff;overflow:hidden;">
<tr><td style="height:13px;padding:0;background:#8641f9;background-image:linear-gradient(100deg,#fff 30%,#eee4ff 57%,#66a4ff 79%,#8849ff);"></td></tr>
<tr><td style="padding:24px 34px 8px;background:#fff;background-image:linear-gradient(110deg,#fff 55%,#eee2ff 85%,#e1d4ff 100%);">
${logo}<p style="margin:5px 0 0;color:#24234c;font-size:16px;">Lo que necesitas, está más cerca.</p></td></tr>
<tr><td class="email-content" style="padding:16px 34px 25px;">
<p class="greeting" style="margin:0 0 10px;font-size:30px;line-height:1.4;color:#0b0b2b;">Hola, <strong style="color:#5c08c7;font-weight:800;">${safeName}</strong>.</p>
<div style="width:59px;height:5px;background:#670bc9;border-radius:5px;margin:0 0 25px;"></div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
<tr><td class="hero-left" width="36%" align="center" valign="middle" style="padding:0 18px 0 0;width:36%;">
<table role="presentation" width="214" cellspacing="0" cellpadding="0" style="width:214px;height:214px;border-collapse:separate;background:#f0eaff;background-image:radial-gradient(circle,#f5efff 2%,#e9dfff 70%,#fff 100%);border-radius:120px;">
<tr><td align="center" valign="middle" style="font-size:0;"><span style="display:inline-block;font-size:125px;line-height:1;color:#8041f4;">&#9993;</span><span style="display:inline-block;background:#7423e0;color:white;font-size:31px;font-weight:800;border:5px solid white;border-radius:50%;width:46px;height:46px;line-height:46px;margin-left:-60px;vertical-align:top;">&#10003;</span></td></tr></table>
</td><td class="hero-line" width="1" style="border-left:1px solid #aea5c8;width:1px;font-size:0;">&nbsp;</td>
<td class="hero-right" valign="middle" style="padding:0 0 0 26px;">
<h1 class="hero-title" style="margin:0 0 14px;color:#090a28;font-size:40px;line-height:1.08;letter-spacing:-1px;font-weight:800;">Verifica tu correo <span style="color:#6207c7;">electrónico</span></h1>
<p class="hero-desc" style="margin:0 0 20px;color:#3b3965;font-size:20px;line-height:1.45;">Confirma tu correo para completar la activación de tu cuenta de ${brandName}.</p>
<table role="presentation" class="cta-wrap" cellpadding="0" cellspacing="0" width="308" style="width:308px;max-width:100%;border-collapse:separate;"><tr><td bgcolor="#7106cb" align="center" style="border-radius:14px;background:#7106cb;background-image:linear-gradient(180deg,#bf55ff,#810cd1 48%,#5203a8);">
<a href="${safeUrl}" target="_blank" style="display:block;padding:16px 10px;color:#fff;font-size:23px;line-height:1.25;font-weight:800;text-decoration:none;white-space:nowrap;border-radius:14px;">&#9993;&nbsp; Verificar correo</a></td></tr></table>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:separate;margin-top:27px;background:#f1ebff;border-radius:15px;"><tr>
<td class="notice-icon" width="82" align="center" valign="middle" style="width:82px;padding:14px 8px;color:#6c0cca;font-size:47px;">&#9716;</td>
<td valign="middle" style="padding:12px 13px;border-left:2px solid #791cd8;">
<p class="notice-text" style="margin:0 0 5px;font-size:18px;line-height:1.4;color:#0b0b2b;">Este enlace vence en <strong style="color:#6807cc;">15 minutos</strong> y solo puede utilizarse una vez.</p>
<p class="notice-text" style="margin:0;color:#33335c;font-size:17px;line-height:1.45;">Si no solicitaste este correo, puedes ignorarlo con tranquilidad.</p></td></tr></table>
</td></tr>
<tr><td class="email-footer" style="padding:23px 34px;border-top:1px solid #e5d5ff;background:#fff;background-image:linear-gradient(11deg,#6aa4ff,#eee0ff 10%,#fff 24%);text-align:center;"><strong style="font-size:28px;color:#090a28;letter-spacing:-.6px;">XAMUKO</strong><span style="padding:0 14px;color:#9890b5;">│</span><span style="font-size:16px;color:#25244c;">Lo que necesitas, está más cerca.</span></td></tr>
</table><p style="margin:15px 0 0;color:#76738a;font-size:11px;">Correo automático de XAMUKO. Por favor, no respondas a este mensaje.</p>
</td></tr></table></body></html>`;
 const text = `Hola, ${input.displayName?.trim() || 'ahí'}.

Verifica tu correo electrónico

Confirma tu correo para completar la activación de tu cuenta de ${brandName}.

Verificar correo: ${url}

Este enlace vence en 15 minutos y solo puede utilizarse una vez. Si no solicitaste este correo, puedes ignorarlo con tranquilidad.

XAMUKO · Lo que necesitas, está más cerca.`;
 return {to:input.to,subject:`Verifica tu correo electrónico de ${brandName}`,html,text};
}

export function renderPasswordResetEmail(input: TemplateInput, application: EmailApplication = 'usuario'): EmailMessage {
  const url = linkFor(input.baseUrl, input.token);
  const brand = emailBrandFor(application);
  return { to: input.to, subject: `Recupera tu contraseña de ${brand.name}`, ...renderBase('Recupera tu contraseña', `Solicitaste cambiar la contraseña de tu cuenta de ${brand.name}.`, 'Restablecer contraseña', url, '30 minutos', input.displayName, application, input.logoUrl) };
}

function renderNotice(input: NoticeInput, title: string, intro: string, subject: string): EmailMessage {
  const application = input.application ?? 'usuario';
  const brand = emailBrandFor(application);
  const safeName = input.displayName?.trim() ? escapeHtml(input.displayName.trim()) : 'ahí';
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  return {
    to: input.to,
    subject: `${subject} · ${brand.name}`,
    html: `<html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;background:#f1f4f2;padding:32px;color:#17211d"><main style="max-width:600px;margin:auto;background:#fff;padding:36px;border:1px solid #e0e8e3;border-radius:16px"><p>Hola, ${safeName}.</p><h1>${safeTitle}</h1><p>${safeIntro}</p><p style="color:#69766f">Si no reconoces esta actividad, cambia tu contraseña y contacta a soporte.</p><p>${brand.name}</p></main></body></html>`,
    text: `Hola, ${input.displayName?.trim() || 'ahí'}.\n\n${title}\n\n${intro}\n\nSi no reconoces esta actividad, cambia tu contraseña y contacta a soporte.\n\n${brand.name}`,
  };
}

export function renderWelcomeEmail(input: NoticeInput): EmailMessage {
  return renderNotice(input, 'Te damos la bienvenida a XAMUKO', 'Tu cuenta ya está creada. Verifica tu correo para empezar a descubrir lo que necesitas cerca.', 'Bienvenido a XAMUKO');
}

export function renderSecurityNotificationEmail(input: NoticeInput, action = 'Se actualizó la seguridad de tu cuenta'): EmailMessage {
  return renderNotice(input, action, 'Te avisamos de este cambio para que puedas mantener el control de tu cuenta.', 'Aviso de seguridad');
}
