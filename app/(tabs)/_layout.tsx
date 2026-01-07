// app/(tabs)/_layout.tsx
// Navigation conditionnelle selon le type de compte (user/business)
// Avec guard d'authentification pour rediriger vers /auth/account-type si non connecté

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

// Tabs pour les utilisateurs standard (5 tabs)
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
    name: 'category',
    route: '/(tabs)/category',
    icon: 'list.bullet.rectangle.fill',
    label: 'Catégories',
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

// Tabs pour les comptes entreprise (5 tabs)
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
    name: 'category',
    route: '/(tabs)/category',
    icon: 'list.bullet.rectangle.fill',
    label: 'Catégories',
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
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [tabs, setTabs] = useState<TabBarItem[]>(userTabs);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Guard d'authentification: rediriger vers /auth/account-type si non connecté
  useEffect(() => {
    if (!loading && !user) {
      setIsRedirecting(true);
      // Utiliser replace pour empêcher le retour arrière vers l'app
      router.replace('/auth/account-type');
    }
  }, [loading, user]);

  useEffect(() => {
    if (profile) {
      setTabs(profile.account_type === 'business' ? businessTabs : userTabs);
    } else {
      // Si pas de profil (non connecté), afficher les tabs utilisateur par défaut
      setTabs(userTabs);
    }
  }, [profile?.account_type]);

  // Écran de chargement pendant la vérification du type de compte ou redirection
  if (loading || isRedirecting || !user) {
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
        <Stack.Screen name="category" />
        
        {/* Écrans spécifiques */}
        <Stack.Screen name="chat" />
        <Stack.Screen name="business-groups" />
      </Stack>
      <FloatingTabBar 
        tabs={tabs} 
        containerWidth={380}
      />
    </>
  );
}