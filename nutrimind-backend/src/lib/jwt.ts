import jwt from 'jsonwebtoken';
import { JWTPayload } from '@/types';

// Load secrets safely from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('[JWT Library] 🛑 CRITICAL ERROR: JWT secrets are undefined in environment variables.');
}

/**
 * Signs a short-lived access token valid for 15 minutes.
 */
export const signAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

/**
 * Signs a long-lived refresh token valid for 7 days.
 */
export const signRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

/**
 * Verifies and decodes an access token.
 * Throws an error if invalid or expired.
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Access token is invalid or expired.');
  }
};

/**
 * Verifies and decodes a refresh token.
 * Throws an error if invalid or expired.
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Refresh token is invalid or expired.');
  }
};
