'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [subTab, setSubTab] = useState<string | null>(null);
  const pathname = usePathname();

  // Automatically reset subTab whenever primary pathname changes
  useEffect(() => {
    setSubTab(null);
  }, [pathname]);

  return (
    <BreadcrumbContext.Provider value={{ subTab, setSubTab }}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

export const useBreadcrumb = () => useContext(BreadcrumbContext);
