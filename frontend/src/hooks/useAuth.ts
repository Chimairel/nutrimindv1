'use client';

import { useContext } from 'react';
import { AuthContext, AuthContextType } from '@/lib/context/AuthContext';

/**
 * Standard react hook to access user session contexts securely.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be utilized within an AuthProvider scope.');
  }
  
  return context;
};

export default useAuth;
