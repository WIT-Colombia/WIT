import { z } from 'zod';

const email = z.string().trim().email().max(320);
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  password,
}).strict();

export const loginSchema = z.object({ email, password, rememberMe: z.boolean().optional().default(false) }).strict();
export const sessionPreferenceSchema = z.object({ rememberMe: z.boolean().optional().default(false) }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(256) }).strict();
export const logoutSchema = refreshSchema;
export const emailTokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
export const emailRequestSchema = z.object({ email }).strict();
export const passwordResetRequestSchema = z.object({ email, application: z.enum(['usuario', 'admin']).optional().default('usuario') }).strict();
export const passwordResetConfirmSchema = z.object({ token: z.string().min(32).max(256), password, rememberMe: z.boolean().optional().default(false) }).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

const nickname = z.string().trim().regex(/^@?[a-zA-Z0-9._-]{3,30}$/, 'El nickname debe tener entre 3 y 30 caracteres válidos.').transform((value) => value.startsWith('@') ? value : `@${value}`);
export const profileUpdateSchema = z.object({ name: z.string().trim().min(2).max(120), nickname: nickname.optional(), avatarUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).max(2048).nullable().optional() }).strict();

export const adultContentPreferenceSchema = z.object({
  enabled: z.boolean(),
  conditionsVersion: z.string().trim().min(1).max(32),
}).strict();

export type AdultContentPreferenceInput = z.infer<typeof adultContentPreferenceSchema>;

export const changePasswordSchema = z.object({
  currentPassword: password,
  newPassword: password,
}).strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
