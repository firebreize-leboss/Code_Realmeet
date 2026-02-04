// app/(tabs)/_layout.tsx
// Navigation avec swipe entre les tabs (style Instagram)
// Avec guard d'authentification pour rediriger vers /auth/account-type si non connecté

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import SwipeableTabView from '@/components/SwipeableTabView';
import { useAuth } from '@/contexts/AuthContext';
import { useTabIndex } from '@/contexts/TabIndexContext';
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

const DEFAULT_TAB_INDEX = 1; // browse

// Derive tab index from a pathname by matching the last segment exactly
function getTabIndexFromPathname(pathname: string, tabs: TabBarItem[]): number {
  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';
  const index = tabs.findIndex(tab => tab.name === lastSegment);
  return index !== -1 ? index : DEFAULT_TAB_INDEX;
}

// Returns true for modal/detail routes that should not affect tab state
function isDetailRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/activity-detail') ||
    pathname.startsWith('/chat-detail') ||
    pathname.startsWith('/user-profile')
  );
}

// Composant interne qui utilise le contexte MapView
function TabLayoutContent() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const { isMapViewActive } = useMapView();

  const isBusiness = profile?.account_type === 'business';
  const tabs = useMemo(() => isBusiness ? businessTabs : userTabs, [isBusiness]);

  const { currentTabIndex, setCurrentTabIndex } = useTabIndex();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Navigation source tracking — reset synchronously in the pathname effect
  const navigationSourceRef = useRef<'swipe' | 'tabbar' | null>(null);
  const prevTabIndexRef = useRef(currentTabIndex);
  const prevIsBusiness = useRef<boolean | null>(null);

  // Mémoriser les paramètres pour éviter les nouvelles références et les boucles infinies
  const stableParams = useMemo(() => ({
    viewMode: params.viewMode,
    selectedActivityId: params.selectedActivityId
  }), [params.viewMode, params.selectedActivityId]);

  // Synchroniser l'index du tab avec la route actuelle
  useEffect(() => {
    // Ignorer les pages modales/détail qui ne doivent pas affecter la navigation par tabs
    if (isDetailRoute(pathname)) {
      return;
    }

    // Ignorer la synchronisation si on vient d'un swipe ou d'un clic sur la tab bar,
    // then clear the flag so the next pathname change is handled normally
    if (navigationSourceRef.current !== null) {
      navigationSourceRef.current = null;
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

    // Synchroniser via le pathname (exact segment match)
    const tabIndex = getTabIndexFromPathname(pathname, tabs);
    if (tabIndex !== prevTabIndexRef.current) {
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
      prevTabIndexRef.current = DEFAULT_TAB_INDEX;
      setCurrentTabIndex(DEFAULT_TAB_INDEX);
    }
    prevIsBusiness.current = isBusiness;
  }, [isBusiness]);

  const handleIndexChange = useCallback((index: number) => {
    navigationSourceRef.current = 'swipe';
    prevTabIndexRef.current = index;
    setCurrentTabIndex(index);
  }, []);

  const handleTabPress = useCallback((index: number) => {
    navigationSourceRef.current = 'tabbar';
    prevTabIndexRef.current = index;
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
