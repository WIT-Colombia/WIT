/**
 * Table-based HTML for transactional email. The images are decorative:
 * the text, link and security instructions stay usable when email clients block images.
 * Only externally hosted HTTPS artwork is used; no data URIs or SVG in messages.
 */
export type BrandedEmailKind = 'password-reset' | 'welcome' | 'security';

export type BrandedEmailLayout = {
  kind: BrandedEmailKind;
  brandName: string;
  displayName?: string;
  title: string;
  description: string;
  notice: string;
  footnote: string;
  action?: { label: string; url: string };
  logoUrl?: string;
};

const BASE_URL = 'https://xamuko.com/assets';
const ARTWORK: Record<BrandedEmailKind, string> = {
  'password-reset': BASE_URL + '/email/reset/ilustracion-candado.png',
  welcome: BASE_URL + '/email/verify/ilustracion-correo.png',
  security: BASE_URL + '/email/reset/ilustracion-candado.png',
};
const CLOCK_URL = BASE_URL + '/email/verify/icono-reloj.png';
const LOGO_URL = 'https://xamuko.com/brand/xamuko-symbol.jpg';

function escapeMarkup(text: string): string {
  return text.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[character] ?? character;
  });
}

export function renderBrandedEmailLayout(input: BrandedEmailLayout): string {
  const name = escapeMarkup(input.displayName?.trim() || 'ahí');
  const title = escapeMarkup(input.title);
  const description = escapeMarkup(input.description);
  const notice = escapeMarkup(input.notice);
  const footnote = escapeMarkup(input.footnote);
  const brandName = escapeMarkup(input.brandName);
  const image = ARTWORK[input.kind];
  // The sender may supply a public HTTPS logo (for future migration to S3/CloudFront).
  const logo = input.logoUrl && /^https:\/\//i.test(input.logoUrl) ? escapeMarkup(input.logoUrl) : LOGO_URL;
  const button = input.action
    ? [
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:345px;border-collapse:separate;">',
        '<tr><td align="center" bgcolor="#6d11dc" style="background-color:#6d11dc;background-image:linear-gradient(110deg,#a619f3,#7411d8 50%,#4e0ab8);border-radius:14px;">',
        '<a href="', escapeMarkup(input.action.url), '" target="_blank" class="mail-button" style="display:block;padding:17px 15px;border-radius:14px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:19px;font-weight:800;line-height:1.3;text-align:center;">', escapeMarkup(input.action.label), '</a>',
        '</td></tr></table>'
      ].join('')
    : '';

  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">',
    '<title>', title, ' | ', brandName, '</title>',
    '<style>',
    '@media only screen and (max-width:660px){',
    '.mail-shell{padding:12px 8px!important}.mail-card{width:100%!important}',
    '.mail-header{padding:18px 18px 8px!important}.brand-logo{width:64px!important;height:64px!important}',
    '.mail-content{padding:12px 18px 22px!important}.mail-greeting{font-size:23px!important}',
    '.mail-art,.mail-copy{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important;padding:6px 0!important}',
    '.mail-art img{width:180px!important;margin:0 auto!important}.mail-divider{display:none!important}',
    '.mail-title{font-size:28px!important}.mail-description{font-size:16px!important}',
    '.mail-button{font-size:17px!important}.mail-notice{padding:12px 10px!important}',
    '.mail-notice-icon{width:56px!important;padding-right:8px!important}.mail-notice-icon img{width:44px!important}',
    '.mail-notice-text{font-size:13px!important}.mail-footer{padding:16px!important}',
    '.mail-footer-logo{width:64px!important;height:64px!important}.mail-footer-tagline{font-size:12px!important}',
    '}',
    '</style></head>',
    '<body style="margin:0;padding:0;background:#f8f7fc;color:#10112d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">',
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">', title, '. ', brandName, '</div>',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background:#f8f7fc;"><tr>',
    '<td class="mail-shell" align="center" style="padding:24px 12px 36px;">',
    '<table class="mail-card" role="presentation" cellspacing="0" cellpadding="0" border="0" width="760" style="width:100%;max-width:760px;border:1px solid #ddd3f8;border-radius:18px;border-collapse:separate;background:#ffffff;overflow:hidden;">',
    '<tr><td style="padding:0;background:#fff;">',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;"><tr>',
    '<td class="mail-header" valign="middle" style="padding:24px 0 10px 38px;background:#fff;">',
    '<img class="brand-logo" src="', logo, '" width="64" height="64" alt="XAMUKO" style="display:block;width:64px;height:64px;max-width:100%;object-fit:contain;border:0;outline:none;text-decoration:none;background:#fff;border-radius:10px;">',
    '</td>',
    '<td width="38%" height="105" bgcolor="#8b4af5" valign="top" style="width:38%;height:105px;background:#8b4af5;background-image:linear-gradient(135deg,#e5bdff 0%,#9850f5 55%,#4c85fa 100%);border-bottom-left-radius:100px;font-size:0;line-height:0;">&nbsp;</td>',
    '</tr></table></td></tr>',
    '<tr><td class="mail-content" style="padding:12px 38px 24px;">',
    '<p class="mail-greeting" style="margin:0 0 10px;color:#0a0b29;font-size:30px;line-height:1.35;">Hola, <strong style="color:#5e0acf;font-weight:800;">', name, '</strong>.</p>',
    '<div style="width:54px;height:5px;margin:0 0 26px;background:#6b08da;border-radius:4px;"></div>',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed;">',
    '<tr><td class="mail-art" width="34%" align="center" valign="middle" style="width:34%;padding:0 18px 0 0;">',
    '<img src="', image, '" alt="" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;">',
    '</td><td class="mail-divider" width="1" style="width:1px;border-left:1px solid #c6b8e5;font-size:0;line-height:0;">&nbsp;</td>',
    '<td class="mail-copy" align="left" valign="middle" style="padding:4px 0 4px 25px;">',
    '<h1 class="mail-title" style="margin:0 0 14px;color:#090b2c;font-family:Arial,Helvetica,sans-serif;font-size:37px;line-height:1.15;letter-spacing:-.7px;font-weight:800;">', title, '</h1>',
    '<p class="mail-description" style="margin:0 0 22px;color:#33365f;font-size:19px;line-height:1.48;">', description, '</p>',
    button,
    '</td></tr></table>',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;margin-top:27px;border-collapse:separate;background:#f0ecff;border-radius:15px;"><tr>',
    '<td class="mail-notice" style="padding:14px 15px;">',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;"><tr>',
    '<td class="mail-notice-icon" width="72" align="center" valign="middle" style="width:72px;padding-right:12px;">',
    '<img src="', CLOCK_URL, '" alt="" width="57" style="display:block;width:57px;max-width:100%;height:auto;border:0;"></td>',
    '<td valign="middle" style="padding:3px 0 3px 15px;border-left:2px solid #7934dc;">',
    '<p class="mail-notice-text" style="margin:0 0 5px;font-size:17px;line-height:1.45;color:#141333;font-weight:700;">', notice, '</p>',
    '<p class="mail-notice-text" style="margin:0;color:#32345c;font-size:15px;line-height:1.5;">', footnote, '</p>',
    '</td></tr></table></td></tr></table>',
    '</td></tr>',
    '<tr><td style="padding:8px 36px 0;"><div style="height:1px;background:#e5d9fa;"></div></td></tr>',
    '<tr><td class="mail-footer" style="padding:22px 34px 26px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;"><tr>',
    '<td align="center" width="45%" valign="middle" style="width:45%;padding:0 8px 0 0;">',
    '<img class="mail-footer-logo" src="', logo, '" alt="XAMUKO" width="64" height="64" style="display:block;width:64px;height:64px;max-width:100%;object-fit:contain;border:0;background:#fff;border-radius:10px;">',
    '</td><td align="left" valign="middle" style="border-left:1px solid #c8bde9;padding:0 0 0 18px;">',
    '<span class="mail-footer-tagline" style="color:#283255;font-size:16px;line-height:1.35;">Lo que necesitas, está más cerca.</span>',
    '</td></tr></table>',
    '</td></tr>',
    '<tr><td height="18" style="height:18px;background:#7754f1;background-image:linear-gradient(100deg,#4a9bff,#8f62f6 44%,#d9adfa 72%,#ffffff 100%);border-radius:0 0 17px 17px;font-size:0;line-height:0;">&nbsp;</td></tr>',
    '</table>',
    '<p style="margin:14px 0 0;color:#7b7590;font-size:11px;line-height:1.5;text-align:center;">Correo automático de XAMUKO. Por favor, no respondas a este mensaje.</p>',
    '</td></tr></table></body></html>'
  ].join('');
}
