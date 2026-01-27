import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { Platform } from "react-native";
import Constants from 'expo-constants';

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

// Vérifie si on est dans un vrai build natif (pas Expo Go)
const isNativeBuild = (): boolean => {
  // En mode dev, jamais utiliser les modules natifs
  if (__DEV__) {
    return false;
  }

  // Seulement sur iOS
  if (Platform.OS !== 'ios') {
    return false;
  }

  // Vérifie si c'est Expo Go (pas un build natif)
  const appOwnership = Constants.appOwnership;
  if (appOwnership === 'expo') {
    return false;
  }

  return true;
};

// Fonction helper pour appeler ExtensionStorage de manière sécurisée
const safeReloadWidget = () => {
  if (!isNativeBuild()) {
    return;
  }

  // Délai pour éviter les race conditions lors de l'initialisation
  setTimeout(() => {
    try {
      // Import dynamique - sera ignoré si le module n'est pas disponible
      const { ExtensionStorage } = require("@bacons/apple-targets");
      if (ExtensionStorage && typeof ExtensionStorage.reloadWidget === 'function') {
        ExtensionStorage.reloadWidget();
      }
    } catch (error) {
      // Silencieux - le module n'est pas disponible
      console.log('[Widget] ExtensionStorage not available:', error);
    }
  }, 100);
};

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  // Update widget state whenever what we want to show changes
  React.useEffect(() => {
    safeReloadWidget();
  }, []);

  const refreshWidget = useCallback(() => {
    safeReloadWidget();
  }, []);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
};
