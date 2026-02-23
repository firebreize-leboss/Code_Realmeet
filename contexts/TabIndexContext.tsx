import React, { createContext, useContext, useState } from 'react';

const DEFAULT_TAB_INDEX = 1; // browse

interface TabIndexContextType {
  currentTabIndex: number;
  setCurrentTabIndex: React.Dispatch<React.SetStateAction<number>>;
}

const TabIndexContext = createContext<TabIndexContextType | undefined>(undefined);

export function TabIndexProvider({ children }: { children: React.ReactNode }) {
  const [currentTabIndex, setCurrentTabIndex] = useState(DEFAULT_TAB_INDEX);

  return (
    <TabIndexContext.Provider value={{ currentTabIndex, setCurrentTabIndex }}>
      {children}
    </TabIndexContext.Provider>
  );
}

export function useTabIndex() {
  const context = useContext(TabIndexContext);
  if (context === undefined) {
    throw new Error('useTabIndex must be used within a TabIndexProvider');
  }
  return context;
}
