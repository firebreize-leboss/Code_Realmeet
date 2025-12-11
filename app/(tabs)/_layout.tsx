// app/(tabs)/_layout.tsx
// Navigation conditionnelle selon le type de compte (user/business)

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

// Tabs pour les utilisateurs standard
const userTabs: TabBarItem[] = [
  {
    name: 'profile',
    route: '/(tabs)/profile',
    icon: 'person.fill',
    label: 'Profil',
  },
  {
    name: 'browse',
    route: '/(tabs)/browse',
    icon: 'square.grid.2x2.fill',
    label: 'Explorer',
  },
  {
    name: 'activity',
    route: '/(tabs)/activity',
    icon: 'calendar',
    label: 'Activités',
  },
  {
    name: 'chat',
    route: '/(tabs)/chat',
    icon: 'message.fill',
    label: 'Messages',
  },
];

// Tabs pour les comptes entreprise
const businessTabs: TabBarItem[] = [
  {
    name: 'profile',
    route: '/(tabs)/profile',
    icon: 'building.2.fill',
    label: 'Dashboard',
  },
  {
    name: 'browse',
    route: '/(tabs)/browse',
    icon: 'eye.fill',
    label: 'Veille',
  },
  {
    name: 'activity',
    route: '/(tabs)/activity',
    icon: 'calendar.badge.plus',
    label: 'Mes activités',
  },
  {
    name: 'business-groups',
    route: '/(tabs)/business-groups',
    icon: 'person.3.fill',
    label: 'Groupes',
  },
];

export default function TabLayout() {
  const { profile, loading } = useAuth();
  const [tabs, setTabs] = useState<TabBarItem[]>(userTabs);

  useEffect(() => {
    if (profile) {
      setTabs(profile.account_type === 'business' ? businessTabs : userTabs);
    }
  }, [profile?.account_type]);

  // Écran de chargement pendant la vérification du type de compte
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isBusiness = profile?.account_type === 'business';

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        {/* Écrans communs aux deux types */}
        <Stack.Screen name="profile" />
        <Stack.Screen name="browse" />
        <Stack.Screen name="activity" />
        
        {/* Écrans spécifiques */}
        <Stack.Screen name="chat" />
        <Stack.Screen name="category" />
        <Stack.Screen name="business-groups" />
      </Stack>
      <FloatingTabBar 
        tabs={tabs} 
        containerWidth={isBusiness ? 340 : 360} 
      />
    </>
  );
}