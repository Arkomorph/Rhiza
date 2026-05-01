import { z } from 'zod';
import { ROLES } from '../types/roles.js';

export const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  username: z.string(),
  role: z.enum(ROLES),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
