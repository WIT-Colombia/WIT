export const formatNumber = (value: number, locale = 'es-CO') => new Intl.NumberFormat(locale).format(value);
export const formatDate = (value: string, locale = 'es-CO', timeZone = 'America/Bogota') => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value));
export const formatMoney = (value: number, currency: string, locale = 'es-CO') => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
