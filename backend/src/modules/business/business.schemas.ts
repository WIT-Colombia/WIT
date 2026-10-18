import { z } from 'zod';

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = (max: number) => z.string().trim().url().max(max).nullable().optional();
const isOfficialSocialHost = (hostname: string, domains: readonly string[]) => domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
const socialUrl = (platform: string, domains: readonly string[]) => z.string().trim().max(2048).transform((value, context) => {
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !isOfficialSocialHost(hostname, domains)) throw new Error('invalid social url');
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `https://${hostname}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    context.addIssue({ code: 'custom', message: `Ingresa un enlace válido de ${platform}.` });
    return z.NEVER;
  }
}).nullable().optional();
const coordinate = (min: number, max: number) => z.union([z.number().finite().min(min).max(max), z.string().trim().regex(/^-?\d{1,3}(?:\.\d{1,8})?$/).transform(Number).pipe(z.number().finite().min(min).max(max))]).nullable().optional();

const businessFields = {
  name: z.string().trim().min(2).max(180),
  sede: nullableText(160),
  adultOnly: z.boolean(),
  description: nullableText(5000),
  categoryId: z.string().uuid().optional(),
  categoryCode: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  website: optionalUrl(2048),
  instagram: socialUrl('Instagram', ['instagram.com']),
  facebookUrl: socialUrl('Facebook', ['facebook.com', 'fb.com']),
  xUrl: socialUrl('X', ['x.com', 'twitter.com']),
  tiktokUrl: socialUrl('TikTok', ['tiktok.com']),
  phone: nullableText(32),
  whatsapp: nullableText(32),
  phonePublic: z.boolean().optional(),
  whatsappPublic: z.boolean().optional(),
  emailPublic: z.boolean().optional(),
  countryCode: z.string().trim().length(2).default('CO'),
  regionCode: nullableText(32),
  regionName: nullableText(160),
  cityName: nullableText(160),
  zoneName: nullableText(160),
  address: nullableText(255),
  additionalAddressInfo: nullableText(200),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  postalCode: nullableText(32),
  timezone: z.string().trim().min(1).max(64).default('America/Bogota'),
} as const;

const modalityTypeSchema = z.enum(['PHYSICAL', 'VIRTUAL', 'DELIVERY']);
const modalityContactSchema = z.object({ email: z.string().trim().email().max(320).nullable().optional(), website: z.string().trim().url().max(2048).nullable().optional(), phone: nullableText(32), whatsapp: nullableText(32) }).strict();
const modalityHourSchema = z.object({ dayOfWeek: z.number().int().min(0).max(6), isClosed: z.boolean().default(false), opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(), closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(), timezone: z.string().trim().min(1).max(64).default('America/Bogota') });
const modalityConfigurationSchema = z.object({ type: modalityTypeSchema, contact: modalityContactSchema.optional(), hours: z.array(modalityHourSchema).max(7).optional() }).strict();
const secondaryCategoryCodesSchema = z.array(z.string().trim().min(1).max(100)).max(32).optional();
const contactValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

export const businessCreateSchema = z.object({ ...businessFields, adultOnly: z.boolean().default(false), phonePublic: z.boolean().default(false), whatsappPublic: z.boolean().default(false), emailPublic: z.boolean().default(false), startModalitiesConfiguring: z.boolean().optional(), locationVisibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'), modalityTypes: z.array(modalityTypeSchema).min(1).max(3).optional(), modalityConfigurations: z.array(modalityConfigurationSchema).max(3).optional(), secondaryCategoryCodes: secondaryCategoryCodesSchema }).strict().superRefine((value, context) => {
  if (!value.categoryId && !value.categoryCode) context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Selecciona una categoría.' });
  if (value.secondaryCategoryCodes) {
    if (new Set(value.secondaryCategoryCodes).size !== value.secondaryCategoryCodes.length) context.addIssue({ code: 'custom', path: ['secondaryCategoryCodes'], message: 'No repitas categorías secundarias.' });
    if (value.categoryCode && value.secondaryCategoryCodes.includes(value.categoryCode)) context.addIssue({ code: 'custom', path: ['secondaryCategoryCodes'], message: 'La categoría principal no puede ser secundaria.' });
  }
  if (value.modalityConfigurations) {
    const types = value.modalityConfigurations.map(item => item.type);
    if (new Set(types).size !== types.length) context.addIssue({ code: 'custom', path: ['modalityConfigurations'], message: 'No repitas configuraciones de modalidad.' });
  }
  const modalities = value.modalityTypes ?? [];
  const hasGeneralContact = (contact: Record<string, unknown>, includeDigital = true) => Boolean(contactValue(contact.email) || contactValue(contact.phone) || contactValue(contact.whatsapp) || (includeDigital && (contactValue(contact.website) || contactValue(contact.instagram))));
  for (const type of modalities) {
    const contact = { email: contactValue(value.email), phone: contactValue(value.phone), whatsapp: contactValue(value.whatsapp), website: contactValue(value.website), instagram: contactValue(value.instagram) };
    if (type === 'DELIVERY' && !hasGeneralContact(contact)) context.addIssue({ code: 'custom', path: ['phone'], message: 'La modalidad a domicilio requiere al menos un canal de contacto.' });
    if (type === 'VIRTUAL' && !contact.whatsapp && !contact.website && !contact.instagram) context.addIssue({ code: 'custom', path: ['website'], message: 'Para activar la atención virtual, agrega WhatsApp, un sitio web o Instagram.' });
  }
  if (modalities.includes('PHYSICAL') && (!value.cityName || !value.address || value.locationVisibility !== 'PUBLIC')) context.addIssue({ code: 'custom', path: ['address'], message: 'La modalidad física requiere una ubicación pública válida.' });
  if (modalities.includes('DELIVERY') && !value.cityName?.trim()) context.addIssue({ code: 'custom', path: ['cityName'], message: 'La modalidad a domicilio requiere una ciudad o municipio.' });
  if (modalities.includes('VIRTUAL') && !value.cityName?.trim()) context.addIssue({ code: 'custom', path: ['cityName'], message: 'La modalidad virtual requiere una ciudad o municipio.' });
});

export const businessUpdateSchema = z.object(businessFields).partial().omit({ categoryId: true, categoryCode: true }).extend({
  categoryId: z.string().uuid().optional(),
  categoryCode: z.string().trim().min(1).max(100).optional(),
  secondaryCategoryCodes: secondaryCategoryCodesSchema,
  deactivateModalities: z.array(modalityTypeSchema).max(3).optional(),
}).strict();

export type BusinessCreateInput = z.infer<typeof businessCreateSchema>;
export type BusinessUpdateInput = z.infer<typeof businessUpdateSchema>;
