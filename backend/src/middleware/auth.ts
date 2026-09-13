import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/lib/jwt';
import { AuthenticatedRequest } from '@/types';
import prisma from '@/lib/prisma';

/**
 * Express middleware to verify the access token from the Authorization header.
 * Attaches the decoded payload to req.user.
 */
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token is required. Format: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token using JWT helper
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired authentication session.' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { email: true, role: true, isSuspended: true },
    });
    if (!currentUser || currentUser.isSuspended) {
      return res.status(401).json({
        success: false,
        error: currentUser?.isSuspended ? 'This account has been suspended.' : 'User session not found.',
      });
    }

    req.user = {
      userId: decoded.userId,
      email: currentUser.email,
      role: currentUser.role,
    };

    next();
  } catch {
    return res.status(503).json({
      success: false,
      error: 'Session verification is temporarily unavailable. Please try again.',
    });
  }
};

export default authenticate;
