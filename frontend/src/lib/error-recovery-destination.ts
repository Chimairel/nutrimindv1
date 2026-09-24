import { getPostAuthDestination } from './post-auth-destination';
import type { UserSession } from './context/AuthContext';

export function getErrorRecoveryDestination(user: UserSession | null): string {
  return user ? getPostAuthDestination(user) : '/login';
}
