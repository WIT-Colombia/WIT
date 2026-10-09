export type EmailApplication = 'usuario' | 'negocios' | 'admin';

export type EmailBrand = {
  application: EmailApplication;
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
};

// Estas variantes reutilizan las variables oficiales de cada aplicación.
const brands: Record<EmailApplication, EmailBrand> = {
  usuario: {
    application: 'usuario',
    name: 'WIT Usuarios',
    primary: '#16B978',
    primaryDark: '#0C8F5B',
    primaryLight: '#DDF7EC',
  },
  negocios: {
    application: 'negocios',
    name: 'WIT Negocios',
    primary: '#2563eb',
    primaryDark: '#1749b8',
    primaryLight: '#eaf2ff',
  },
  admin: {
    application: 'admin',
    name: 'WIT Admin',
    primary: '#6D5AE6',
    primaryDark: '#5142B5',
    primaryLight: '#E9E6FF',
  },
};

export function emailBrandFor(application: EmailApplication = 'usuario'): EmailBrand {
  return brands[application];
}
