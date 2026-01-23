import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_VELOCITY_THRESHOLD = 500; // Vélocité minimale pour un swipe rapide

interface SwipeableTabViewProps {
  children: React.ReactNode[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  enabled?: boolean;
}

const springConfig = {
  damping: 20,
  stiffness: 90,
  mass: 0.8,
};

export default function SwipeableTabView({
  children,
  currentIndex,
  onIndexChange,
  enabled = true,
}: SwipeableTabViewProps) {
  const translateX = useSharedValue(-currentIndex * SCREEN_WIDTH);
  const contextX = useSharedValue(0);
  const isGestureActive = useSharedValue(false);
  const lastSyncedIndex = useRef(currentIndex);

  const tabCount = children.length;

  // Sync translateX when currentIndex changes externally (e.g., tab bar press)
  useEffect(() => {
    if (!isGestureActive.value && lastSyncedIndex.current !== currentIndex) {
      lastSyncedIndex.current = currentIndex;
      translateX.value = withSpring(-currentIndex * SCREEN_WIDTH, springConfig);
    }
  }, [currentIndex]);

  const clamp = (value: number, min: number, max: number) => {
    'worklet';
    return Math.max(min, Math.min(max, value));
  };

  const handleIndexChange = useCallback(
    (newIndex: number) => {
      lastSyncedIndex.current = newIndex;
      onIndexChange(newIndex);
    },
    [onIndexChange]
  );

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-15, 15]) // Activer après 15px de mouvement horizontal
    .failOffsetY([-10, 10]) // Échouer si mouvement vertical > 10px (pour scroll)
    .onStart(() => {
      'worklet';
      isGestureActive.value = true;
      contextX.value = translateX.value;
    })
    .onUpdate((event) => {
      'worklet';
      // Calculer la nouvelle position avec résistance aux bords
      const newTranslateX = contextX.value + event.translationX;
      const minTranslate = -(tabCount - 1) * SCREEN_WIDTH;
      const maxTranslate = 0;

      // Ajouter une résistance élastique aux bords
      if (newTranslateX > maxTranslate) {
        // Résistance à gauche (premier tab)
        translateX.value = maxTranslate + (newTranslateX - maxTranslate) * 0.25;
      } else if (newTranslateX < minTranslate) {
        // Résistance à droite (dernier tab)
        translateX.value = minTranslate + (newTranslateX - minTranslate) * 0.25;
      } else {
        translateX.value = newTranslateX;
      }
    })
    .onEnd((event) => {
      'worklet';
      isGestureActive.value = false;

      const currentTranslate = translateX.value;
      const currentTabFromTranslate = -currentTranslate / SCREEN_WIDTH;

      let targetIndex: number;

      // Déterminer le tab cible basé sur la vélocité et la distance
      if (Math.abs(event.velocityX) > SWIPE_VELOCITY_THRESHOLD) {
        // Swipe rapide - aller au tab suivant/précédent
        if (event.velocityX > 0) {
          targetIndex = Math.floor(currentTabFromTranslate);
        } else {
          targetIndex = Math.ceil(currentTabFromTranslate);
        }
      } else {
        // Swipe lent - arrondir à l'index le plus proche
        targetIndex = Math.round(currentTabFromTranslate);
      }

      // Clamp l'index dans les limites valides
      targetIndex = clamp(targetIndex, 0, tabCount - 1);

      // Animer vers la position finale
      translateX.value = withSpring(-targetIndex * SCREEN_WIDTH, {
        ...springConfig,
        velocity: event.velocityX,
      });

      // Mettre à jour l'index si différent
      if (targetIndex !== currentIndex) {
        runOnJS(handleIndexChange)(targetIndex);
      }
    });

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  // Mémoiser les styles des tabs
  const tabStyle = useMemo(
    () => ({
      width: SCREEN_WIDTH,
      flex: 1,
    }),
    []
  );

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.tabsWrapper,
            { width: SCREEN_WIDTH * tabCount },
            animatedContainerStyle,
          ]}
        >
          {children.map((child, index) => (
            <View key={index} style={[styles.tabContainer, tabStyle]}>
              {child}
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  tabsWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  tabContainer: {
    flex: 1,
    overflow: 'hidden',
  },
});
