import { z } from 'zod';

export const modalityTypeSchema = z.enum(['PHYSICAL', 'VIRTUAL', 'DELIVERY']);
export const modalityIdSchema = z.string().uuid();

// Compatible with JavaScript Date#getDay: 0 Sunday, 1 Monday ... 6 Saturday.
export const modalityDayOfWeek = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createModalitySchema = z.object({ type: modalityTypeSchema }).strict();
export const contactSchema = z.object({
  email: z.string().trim().email().max(320).nullable().optional(),
  website: z.string().trim().url().max(2048).nullable().optional(),
  phone: optionalText(32),
  whatsapp: optionalText(32),
}).strict();

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const modalityHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean().default(false),
  opensAt: timeSchema.nullable().optional(),
  closesAt: timeSchema.nullable().optional(),
  timezone: z.string().trim().min(1).max(64).default('America/Bogota'),
}).superRefine((hour, context) => {
  if (hour.isClosed) {
    if (hour.opensAt !== null && hour.opensAt !== undefined || hour.closesAt !== null && hour.closesAt !== undefined) {
      context.addIssue({ code: 'custom', path: ['opensAt'], message: 'Un día cerrado no puede tener horario.' });
    }
    return;
  }
  if (!hour.opensAt || !hour.closesAt) {
    context.addIssue({ code: 'custom', path: ['opensAt'], message: 'El horario abierto requiere inicio y cierre.' });
  } else if (hour.opensAt >= hour.closesAt) {
    context.addIssue({ code: 'custom', path: ['closesAt'], message: 'La hora de cierre debe ser posterior a la de apertura.' });
  }
});
export const hoursSchema = z.object({ hours: z.array(modalityHourSchema).max(7) }).superRefine((value, context) => {
  const days = new Set(value.hours.map((hour) => hour.dayOfWeek));
  if (days.size !== value.hours.length) context.addIssue({ code: 'custom', path: ['hours'], message: 'No puede haber dos horarios para el mismo día.' });
});

export type CreateModalityInput = z.infer<typeof createModalitySchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type ModalityHourInput = z.infer<typeof modalityHourSchema>;
export type HoursInput = z.infer<typeof hoursSchema>;
