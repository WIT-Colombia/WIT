import { z } from 'zod';

const date = z.string().datetime({ offset: true });
const promotionFields = {
  type: z.enum(['OFFER', 'PROMOTION']),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  conditions: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  relatedOfferId: z.string().uuid().nullable().optional(),
  originalPrice: z.union([z.number().finite().nonnegative(), z.string().trim().max(32)]).nullable().optional(),
  promotionalPrice: z.union([z.number().finite().nonnegative(), z.string().trim().max(32)]).nullable().optional(),
  startsAt: date,
  endsAt: date,
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('NONE'),
  recurrenceUntil: date.nullable().optional(),
  idempotencyKey: z.string().uuid().optional(),
} as const;

export const promotionCreateSchema = z.object(promotionFields).strict();
export const promotionUpdateSchema = z.object({ ...promotionFields, idempotencyKey: z.never().optional() }).partial().strict();
export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>;
export type PromotionUpdateInput = z.infer<typeof promotionUpdateSchema>;
