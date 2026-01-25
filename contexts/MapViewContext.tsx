// contexts/MapViewContext.tsx
// Contexte pour partager l'état de la vue maps entre les composants

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MapViewContextType {
  isMapViewActive: boolean;
  setIsMapViewActive: (active: boolean) => void;
}

const MapViewContext = createContext<MapViewContextType | undefined>(undefined);

export function MapViewProvider({ children }: { children: ReactNode }) {
  const [isMapViewActive, setIsMapViewActive] = useState(false);

  return (
    <MapViewContext.Provider value={{ isMapViewActive, setIsMapViewActive }}>
      {children}
    </MapViewContext.Provider>
  );
}

export function useMapView() {
  const context = useContext(MapViewContext);
  if (context === undefined) {
    throw new Error('useMapView must be used within a MapViewProvider');
  }
  return context;
}
