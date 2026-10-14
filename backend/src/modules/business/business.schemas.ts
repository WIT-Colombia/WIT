import { z } from 'zod';

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = (max: number) => z.string().trim().url().max(max).nullable().optional();

const businessFields = {
  name: z.string().trim().min(2).max(180),
  description: nullableText(5000),
  categoryId: z.string().uuid().optional(),
  categoryCode: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  website: optionalUrl(2048),
  instagram: nullableText(255),
  phone: nullableText(32),
  whatsapp: nullableText(32),
  countryCode: z.string().trim().length(2).default('CO'),
  regionCode: nullableText(32),
  regionName: nullableText(160),
  cityName: nullableText(160),
  zoneName: nullableText(160),
  address: nullableText(255),
  additionalAddressInfo: nullableText(200),
  postalCode: nullableText(32),
  timezone: z.string().trim().min(1).max(64).default('America/Bogota'),
} as const;

const modalityTypeSchema = z.enum(['PHYSICAL', 'VIRTUAL', 'DELIVERY']);
const modalityContactSchema = z.object({ email: z.string().trim().email().max(320).nullable().optional(), website: z.string().trim().url().max(2048).nullable().optional(), phone: nullableText(32), whatsapp: nullableText(32) }).strict();
const modalityHourSchema = z.object({ dayOfWeek: z.number().int().min(0).max(6), isClosed: z.boolean().default(false), opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(), closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(), timezone: z.string().trim().min(1).max(64).default('America/Bogota') });
const modalityConfigurationSchema = z.object({ type: modalityTypeSchema, contact: modalityContactSchema.optional(), hours: z.array(modalityHourSchema).max(7).optional() }).strict();
const secondaryCategoryCodesSchema = z.array(z.string().trim().min(1).max(100)).max(32).optional();
const contactValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

export const businessCreateSchema = z.object({ ...businessFields, locationVisibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'), modalityTypes: z.array(modalityTypeSchema).min(1).max(3).optional(), modalityConfigurations: z.array(modalityConfigurationSchema).max(3).optional(), secondaryCategoryCodes: secondaryCategoryCodesSchema }).strict().superRefine((value, context) => {
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
