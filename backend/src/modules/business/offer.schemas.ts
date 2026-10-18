import { z } from 'zod';

const offerFields = {
  kind: z.enum(['PRODUCT', 'SERVICE']),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(5000).nullable().optional(),
  priceAmount: z.union([z.number().finite().nonnegative(), z.string().trim().max(32)]).nullable().optional(),
  currency: z.string().trim().length(3).nullable().optional(),
  priceText: z.string().trim().max(180).nullable().optional(),
  negotiable: z.boolean().default(false),
  active: z.boolean().default(true),
  adultOnly: z.boolean().default(false),
  publicationStatus: z.enum(['UNPUBLISHED', 'PUBLISHED', 'REVIEW']).default('UNPUBLISHED'),
} as const;

export const offerCreateSchema = z.object(offerFields).strict();
export const offerUpdateSchema = z.object({
  kind: z.enum(['PRODUCT', 'SERVICE']).optional(),
  name: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  priceAmount: z.union([z.number().finite().nonnegative(), z.string().trim().max(32)]).nullable().optional(),
  currency: z.string().trim().length(3).nullable().optional(),
  priceText: z.string().trim().max(180).nullable().optional(),
  negotiable: z.boolean().optional(),
  active: z.boolean().optional(),
  adultOnly: z.boolean().optional(),
  publicationStatus: z.enum(['UNPUBLISHED', 'PUBLISHED', 'REVIEW']).optional(),
}).strict();
export type OfferCreateInput = z.infer<typeof offerCreateSchema>;
export type OfferUpdateInput = z.infer<typeof offerUpdateSchema>;
