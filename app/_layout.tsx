import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, Alert } from "react-native";
import { useNetworkState } from "expo-network";

import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button } from "@/components/button";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataCacheProvider } from "@/contexts/DataCacheContext";
import { notificationService } from "@/lib/notifications";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Initialisation des notifications push (seulement en production)
  useEffect(() => {
    if (!__DEV__) {
      notificationService.initialize();
      
      return () => {
        notificationService.cleanup();
      };
    }
  }, []);

  React.useEffect(() => {
    if (
      !networkState.isConnected &&
      networkState.isInternetReachable === false
    ) {
      Alert.alert(
        "🔌 You are offline",
        "You can keep using the app! Your changes will be saved locally and synced when you are back online."
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  if (!loaded) {
    return null;
  }

  // Modern 2025 Light Theme - Vibrant & Friendly
  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "rgb(255, 107, 157)", // Vibrant coral-pink (#FF6B9D)
      background: "rgb(250, 250, 250)", // Very light gray (#FAFAFA)
      card: "rgb(255, 255, 255)", // Pure white for cards
      text: "rgb(26, 26, 26)", // Very dark gray/almost black (#1A1A1A)
      border: "rgb(224, 224, 224)", // Light border (#E0E0E0)
      notification: "rgb(239, 83, 80)", // Modern red (#EF5350)
    },
  };

  // Keep dark theme as fallback (but we're focusing on light mode)
  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "rgb(255, 107, 157)", // Same coral-pink for consistency
      background: "rgb(250, 250, 250)", // Light theme background
      card: "rgb(255, 255, 255)", // Light theme cards
      text: "rgb(26, 26, 26)", // Dark text for light mode
      border: "rgb(224, 224, 224)", // Light borders
      notification: "rgb(239, 83, 80)", // Modern red
    },
  };

  return (
    <>
      <StatusBar style="dark" animated />
      <SafeAreaProvider>
        <AuthProvider>
          <DataCacheProvider>
            <ThemeProvider
              value={CustomDefaultTheme}
            >
              <SystemBars style="auto" />
              <GestureHandlerRootView style={{ flex: 1 }}>
                <WidgetProvider>
                  <Stack>
                  {/* Main app with tabs */}
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

                  {/* Modal Demo Screens */}
                  <Stack.Screen
                    name="modal"
                    options={{
                      presentation: "modal",
                      title: "Standard Modal",
                    }}
                  />
                  <Stack.Screen
                    name="formsheet"
                    options={{
                      presentation: "formSheet",
                      title: "Form Sheet Modal",
                      sheetGrabberVisible: true,
                      sheetAllowedDetents: [0.5, 0.8, 1.0],
                      sheetCornerRadius: 20,
                    }}
                  />
                  <Stack.Screen
                    name="transparent-modal"
                    options={{
                      presentation: "transparentModal",
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="category-activities"
                    options={{
                      headerShown: false,
                    }}
                  />
                  </Stack>
                </WidgetProvider>
              </GestureHandlerRootView>
            </ThemeProvider>
          </DataCacheProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </>
  );
}