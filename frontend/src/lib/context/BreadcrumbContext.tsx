'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

interface BreadcrumbContextType {
  subTab: string | null;
  setSubTab: (tab: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  subTab: null,
  setSubTab: () => {},
});

export const BreadcrumbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subTab, setSubTabState] = useState<string | null>(null);
  const pathname = usePathname();

  const setSubTab = useCallback((tab: string | null) => {
    setSubTabState((prev) => (prev === tab ? prev : tab));
  }, []);

  // Automatically reset subTab whenever primary pathname changes
  useEffect(() => {
    setSubTab(null);
  }, [pathname, setSubTab]);

  const value = useMemo(() => ({ subTab, setSubTab }), [subTab, setSubTab]);

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
};

export const useBreadcrumb = () => useContext(BreadcrumbContext);
