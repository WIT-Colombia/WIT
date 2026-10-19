import { z } from 'zod';

export const preferredLocationSchema = z.object({
  city: z.string().trim().min(1).max(160),
  region: z.string().trim().max(160).optional().nullable(),
  country: z.string().trim().min(1).max(80).default('Colombia'),
  name: z.string().trim().min(1).max(240),
  latitude: z.number().finite().min(-90).max(90).optional().nullable(),
  longitude: z.number().finite().min(-180).max(180).optional().nullable(),
  mode: z.enum(['MANUAL', 'GPS']),
  resolution: z.enum(['PENDING', 'RESOLVED', 'UNAVAILABLE']).default('PENDING'),
  clientUpdatedAt: z.number().int().positive().optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.latitude == null) !== (value.longitude == null)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'Las coordenadas deben llegar juntas.' });
});
export type PreferredLocationInput = z.infer<typeof preferredLocationSchema>;
