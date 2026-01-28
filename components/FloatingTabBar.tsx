import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { BlurView } from 'expo-blur';
import { useTheme } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { colors, borderRadius, spacing, shadows } from '@/styles/commonStyles';

// Constante exportée pour la hauteur de la tab bar (utilisée par d'autres composants pour le positionnement)
export const FLOATING_TAB_BAR_HEIGHT = 60;

export interface TabBarItem {
  name: string;
  route: string;
  icon: string;
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
  containerWidth?: number;
  borderRadius?: number;
  bottomMargin?: number;
  currentIndex?: number;
  onTabPress?: (index: number) => void;
}

export default function FloatingTabBar({
  tabs = [],
  containerWidth = 240,
  borderRadius = 25,
  bottomMargin,
  currentIndex,
  onTabPress,
}: FloatingTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const animatedValue = useSharedValue(0);
  const { width: screenWidth } = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  // Utiliser currentIndex si fourni, sinon détecter via pathname (mode legacy)
  const activeTabIndex = React.useMemo(() => {
    // Si currentIndex est fourni, l'utiliser directement
    if (currentIndex !== undefined) {
      return currentIndex;
    }

    // Mode legacy: détecter via pathname
    if (!tabs || tabs.length === 0) return 0;
    let bestMatch = -1;
    let bestMatchScore = 0;

    tabs.forEach((tab, index) => {
      let score = 0;

      if (pathname === tab.route) {
        score = 100;
      } else if (pathname.startsWith(tab.route)) {
        score = 80;
      } else if (pathname.includes(tab.name)) {
        score = 60;
      } else if (tab.route.includes('/(tabs)/') && pathname.includes(tab.route.split('/(tabs)/')[1])) {
        score = 40;
      }

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = index;
      }
    });

    return bestMatch >= 0 ? bestMatch : 0;
  }, [pathname, tabs, currentIndex]);

  React.useEffect(() => {
    if (activeTabIndex >= 0) {
      animatedValue.value = activeTabIndex;
    }
  }, [activeTabIndex, animatedValue]);

  const handleTabPress = (index: number, route: string) => {
    if (onTabPress) {
      onTabPress(index);
    } else {
      router.push(route);
    }
  };

  // Remove unnecessary tabBarStyle animation to prevent flickering

  const indicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (containerWidth - 16) / tabs.length; // Account for container padding (8px on each side)
    return {
      transform: [
        {
          translateX: interpolate(
            animatedValue.value,
            [0, tabs.length - 1],
            [0, tabWidth * (tabs.length - 1)]
          ),
        },
      ],
    };
  });

  // Dynamic styles based on theme - Glassmorphism effect like profile.tsx
  const dynamicStyles = {
    blurContainer: {
      ...styles.blurContainer,
      ...Platform.select({
        ios: {
          backgroundColor: 'rgba(255, 255, 255, 0.75)', // Increased opacity for better readability
        },
        android: {
          backgroundColor: 'rgba(255, 255, 255, 0.75)', // Increased opacity for better readability
          elevation: 0,
        },
        web: {
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(20px)',
          boxShadow: 'none',
        },
      }),
    },
    background: {
      ...styles.background,
      backgroundColor: 'transparent',
    },
    indicator: {
      ...styles.indicator,
      backgroundColor: 'rgba(255, 255, 255, 0.4)', // Increased opacity for better contrast
      width: `${(100 / tabs.length) - 3}%`, // Dynamic width based on number of tabs
    },
  };

  // Calculer le bottom margin de manière stable
  const safeAreaBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0);
  const finalBottomMargin = (bottomMargin ?? 0) + safeAreaBottom;

  return (
    <View
      style={[
        styles.safeArea,
        { paddingBottom: finalBottomMargin }
      ]}
    >
      <View style={[
        styles.container,
        {
          width: containerWidth,
        }
      ]}>
        <BlurView
          intensity={Platform.OS === 'web' ? 0 : 80}
          tint="light"
          style={[dynamicStyles.blurContainer, { borderRadius }]}
        >
          <View style={dynamicStyles.background} />
          <Animated.View style={[dynamicStyles.indicator, indicatorStyle]} />
          <View style={styles.tabsContainer}>
            {tabs.map((tab, index) => {
              const isActive = activeTabIndex === index;

              return (
                <TouchableOpacity
                  key={tab.name}
                  style={styles.tab}
                  onPress={() => handleTabPress(index, tab.route)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    <IconSymbol
                      name={tab.icon}
                      size={22}
                      color={isActive ? colors.primary : colors.textTertiary}
                    />
                    <Text
                      style={[
                        styles.tabLabel,
                        { color: colors.textTertiary },
                        isActive && {
                          color: colors.primary,
                          fontWeight: '600'
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  container: {
    alignSelf: 'center',
  },
  blurContainer: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)', // Subtle border for better definition
    // borderRadius and other styling applied dynamically
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    // Dynamic styling applied in component
  },
  indicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    bottom: 8,
    borderRadius: 17,
    width: `${(100 / 2) - 3}%`, // Default for 2 tabs, will be overridden by dynamic styles
    // Dynamic styling applied in component
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    // Dynamic styling applied in component
  },
});
