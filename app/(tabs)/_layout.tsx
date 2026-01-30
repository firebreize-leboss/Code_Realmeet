// app/(tabs)/_layout.tsx
// Navigation avec swipe entre les tabs (style Instagram)
// Avec guard d'authentification pour rediriger vers /auth/account-type si non connecté

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
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
  const renderCount = useRef(0);
  renderCount.current += 1;

  // Debug: identifier les instances multiples
  useEffect(() => {
    const instanceId = Math.random().toString(36).substr(2, 9);
    console.log('[DEBUG _layout] MOUNT instance:', instanceId);
    return () => console.log('[DEBUG _layout] UNMOUNT instance:', instanceId);
  }, []);

  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const { isMapViewActive } = useMapView();
  const [currentTabIndex, setCurrentTabIndex] = useState(() => {
    // browse est toujours à l'index 1 dans userTabs et businessTabs
    if (pathname.includes('browse')) {
      return 1;
    }
    return 0;
  });
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isSwipeNavigation = useRef(false);
  const isTabBarNavigation = useRef(false);
  const prevTabIndexRef = useRef(currentTabIndex);

  const isBusiness = profile?.account_type === 'business';
  const tabs = useMemo(() => isBusiness ? businessTabs : userTabs, [isBusiness]);
  const prevIsBusiness = useRef<boolean | null>(null);

  // Mémoriser les paramètres pour éviter les nouvelles références et les boucles infinies
  const stableParams = useMemo(() => ({
    viewMode: params.viewMode,
    selectedActivityId: params.selectedActivityId
  }), [params.viewMode, params.selectedActivityId]);

  // Synchroniser l'index du tab avec la route actuelle
  useEffect(() => {
    // Ignorer les pages modales/détail qui ne doivent pas affecter la navigation par tabs
    if (
      pathname.includes('detail') ||
      pathname.startsWith('/activity-detail') ||
      pathname.startsWith('/chat-detail') ||
      pathname.startsWith('/user-profile')
    ) {
      return;
    }

    // Ignorer la synchronisation si on vient d'un swipe ou d'un clic sur la tab bar
    if (isSwipeNavigation.current) {
      return;
    }
    if (isTabBarNavigation.current) {
      return;
    }

    // Vérifier si on navigue vers browse avec des paramètres (ex: viewMode=maps)
    if (stableParams.viewMode === 'maps' || stableParams.selectedActivityId) {
      const browseIndex = tabs.findIndex(tab => tab.name === 'browse');
      if (browseIndex !== -1 && browseIndex !== prevTabIndexRef.current) {
        prevTabIndexRef.current = browseIndex;
        setCurrentTabIndex(browseIndex);
        return;
      }
    }

    // Sinon, synchroniser via le pathname
    const tabIndex = tabs.findIndex(tab => pathname.includes(tab.name));
    if (tabIndex !== -1 && tabIndex !== prevTabIndexRef.current) {
      prevTabIndexRef.current = tabIndex;
      setCurrentTabIndex(tabIndex);
    }
  }, [pathname, stableParams, tabs]);

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

  // Réinitialiser l'index du tab quand le type de compte change (pas au montage initial)
  useEffect(() => {
    if (prevIsBusiness.current !== null && prevIsBusiness.current !== isBusiness) {
      prevTabIndexRef.current = 0;
      setCurrentTabIndex(0);
    }
    prevIsBusiness.current = isBusiness;
  }, [isBusiness]);

  const handleIndexChange = useCallback((index: number) => {
    isSwipeNavigation.current = true;
    prevTabIndexRef.current = index;
    setCurrentTabIndex(index);
    setTimeout(() => {
      isSwipeNavigation.current = false;
    }, 100);
  }, [tabs]);

  const handleTabPress = useCallback((index: number) => {
    isTabBarNavigation.current = true;
    prevTabIndexRef.current = index;
    setCurrentTabIndex(index);
    setTimeout(() => {
      isTabBarNavigation.current = false;
    }, 100);
  }, [tabs]);

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
