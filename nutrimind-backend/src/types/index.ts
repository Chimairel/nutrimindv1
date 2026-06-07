import { Request } from 'express';

export type Role = 'USER' | 'NUTRITIONIST' | 'ADMIN';

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}
