import { JWTPayload } from '@/types';
/**
 * Signs a short-lived access token valid for 15 minutes.
 */
export declare const signAccessToken: (payload: JWTPayload) => string;
/**
 * Signs a long-lived refresh token valid for 7 days.
 */
export declare const signRefreshToken: (payload: JWTPayload) => string;
/**
 * Verifies and decodes an access token.
 * Throws an error if invalid or expired.
 */
export declare const verifyAccessToken: (token: string) => JWTPayload;
/**
 * Verifies and decodes a refresh token.
 * Throws an error if invalid or expired.
 */
export declare const verifyRefreshToken: (token: string) => JWTPayload;
//# sourceMappingURL=jwt.d.ts.map