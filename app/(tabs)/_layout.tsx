// app/(tabs)/_layout.tsx
// Navigation avec swipe entre les tabs (style Instagram)
// Avec guard d'authentification pour rediriger vers /auth/account-type si non connecté

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import SwipeableTabView from '@/components/SwipeableTabView';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { MapViewProvider, useMapView } from '@/contexts/MapViewContext';

// Import des écrans
import ProfileScreen from './profile';
import BrowseScreen from './browse';
import CategoryScreen from './category';
import ActivityScreen from './activity';
import ChatScreen from './chat';
import BusinessGroupsScreen from './business-groups';

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

// Composant interne qui utilise le contexte MapView
function TabLayoutContent() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const { isMapViewActive } = useMapView();
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isBusiness = profile?.account_type === 'business';
  const tabs = isBusiness ? businessTabs : userTabs;

  // Synchroniser l'index du tab avec la route actuelle
  useEffect(() => {
    // Vérifier si on navigue vers browse avec des paramètres (ex: viewMode=maps)
    if (params.viewMode === 'maps' || params.selectedActivityId) {
      const browseIndex = tabs.findIndex(tab => tab.name === 'browse');
      if (browseIndex !== -1 && browseIndex !== currentTabIndex) {
        setCurrentTabIndex(browseIndex);
        return;
      }
    }

    // Sinon, synchroniser via le pathname
    const tabIndex = tabs.findIndex(tab => pathname.includes(tab.name));
    if (tabIndex !== -1 && tabIndex !== currentTabIndex) {
      setCurrentTabIndex(tabIndex);
    }
  }, [pathname, params, tabs]);

  // Désactiver le swipe quand on est sur le tab browse (index 1) et que la vue maps est active
  const isSwipeEnabled = !(currentTabIndex === 1 && isMapViewActive);

  // Mémoiser les écrans pour éviter les re-renders inutiles
  const tabScreens = useMemo(() => {
    if (isBusiness) {
      return [
        <ProfileScreen key="profile" />,
        <BrowseScreen key="browse" />,
        <CategoryScreen key="category" />,
        <ActivityScreen key="activity" />,
        <BusinessGroupsScreen key="business-groups" />,
      ];
    }
    return [
      <ProfileScreen key="profile" />,
      <BrowseScreen key="browse" />,
      <CategoryScreen key="category" />,
      <ActivityScreen key="activity" />,
      <ChatScreen key="chat" />,
    ];
  }, [isBusiness]);

  // Guard d'authentification: rediriger vers /auth/account-type si non connecté
  useEffect(() => {
    if (!loading && !user) {
      setIsRedirecting(true);
      router.replace('/auth/account-type');
    }
  }, [loading, user]);

  // Réinitialiser l'index du tab quand le type de compte change
  useEffect(() => {
    setCurrentTabIndex(0);
  }, [isBusiness]);

  const handleIndexChange = useCallback((index: number) => {
    setCurrentTabIndex(index);
  }, []);

  const handleTabPress = useCallback((index: number) => {
    setCurrentTabIndex(index);
  }, []);

  // Écran de chargement pendant la vérification du type de compte ou redirection
  if (loading || isRedirecting || !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SwipeableTabView
        currentIndex={currentTabIndex}
        onIndexChange={handleIndexChange}
        enabled={isSwipeEnabled}
      >
        {tabScreens}
      </SwipeableTabView>
      <FloatingTabBar
        tabs={tabs}
        containerWidth={380}
        currentIndex={currentTabIndex}
        onTabPress={handleTabPress}
      />
    </View>
  );
}

// Composant principal qui fournit le contexte MapView
export default function TabLayout() {
  return (
    <MapViewProvider>
      <TabLayoutContent />
    </MapViewProvider>
  );
}
