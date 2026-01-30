import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  View,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
  ScrollView,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SwipeableTabViewProps {
  children: React.ReactNode[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  enabled?: boolean;
}

export default function SwipeableTabView({
  children,
  currentIndex,
  onIndexChange,
  enabled = true,
}: SwipeableTabViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const currentIndexRef = useRef(currentIndex);
  const isScrollingProgrammatically = useRef(false);
  const isDragging = useRef(false);
  const lastOffsetX = useRef(0);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  const tabCount = children.length;

  // Initial scroll au bon index après le layout
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    if (!isLayoutReady) {
      setIsLayoutReady(true);
      // Scroll immédiat sans animation pour l'initialisation
      if (currentIndex > 0 && scrollViewRef.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: currentIndex * SCREEN_WIDTH,
            y: 0,
            animated: false,
          });
        }, 50);
      }
    }
  }, [isLayoutReady, currentIndex]);

  // Synchronisation quand currentIndex change depuis l'extérieur (tap sur tab bar)
  useEffect(() => {
    if (!isLayoutReady || !scrollViewRef.current) {
      return;
    }

    // Toujours mettre à jour currentIndexRef pour suivre les changements externes
    if (currentIndex !== currentIndexRef.current) {
      // Ne pas scroller si on est en train de drag
      if (isDragging.current) {
        currentIndexRef.current = currentIndex;
        return;
      }

      currentIndexRef.current = currentIndex;
      isScrollingProgrammatically.current = true;

      // Scroll animé vers le nouvel index - utilise la méthode native scrollTo
      // Petit délai pour assurer que la ref est prête sur Android
      requestAnimationFrame(() => {
        if (scrollViewRef.current) {
          const targetX = currentIndex * SCREEN_WIDTH;
          scrollViewRef.current.scrollTo({
            x: targetX,
            y: 0,
            animated: true,
          });
        }
      });

      // Reset du flag après l'animation
      const timer = setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, isLayoutReady]);

  // Handler quand le scroll se termine après un drag (avec momentum)
  const onMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    const clampedIndex = Math.max(0, Math.min(newIndex, tabCount - 1));

    isDragging.current = false;

    if (isScrollingProgrammatically.current) {
      return;
    }

    if (clampedIndex !== currentIndexRef.current) {
      currentIndexRef.current = clampedIndex;
      onIndexChange(clampedIndex);
    }
  }, [onIndexChange, tabCount]);

  // Handler pour le début du drag
  const onScrollBeginDrag = useCallback(() => {
    isDragging.current = true;
    isScrollingProgrammatically.current = false;
  }, []);

  // Handler pour tracker la position du scroll (utilisé pour iOS)
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    lastOffsetX.current = contentOffset.x;
  }, []);

  // Handler pour la fin du drag (avant momentum)
  const onScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, velocity } = event.nativeEvent;

    // Sur iOS avec pagingEnabled, onMomentumScrollEnd n'est pas toujours appelé
    // On utilise un timeout pour lire la position finale après l'animation de paging
    if (Platform.OS === 'ios') {
      setTimeout(() => {
        if (!isDragging.current) {
          return;
        }
        isDragging.current = false;

        // Utiliser la dernière position enregistrée par onScroll
        const newIndex = Math.round(lastOffsetX.current / SCREEN_WIDTH);
        const clampedIndex = Math.max(0, Math.min(newIndex, tabCount - 1));

        if (clampedIndex !== currentIndexRef.current) {
          currentIndexRef.current = clampedIndex;
          onIndexChange(clampedIndex);
        }
      }, 350); // Attendre que l'animation de paging soit terminée
      return;
    }

    // Android: Vérifier si le momentum sera déclenché
    const velocityX = velocity?.x ?? 0;

    // Si pas de velocity significative, onMomentumScrollEnd peut ne pas être appelé
    // donc on gère le changement ici
    if (Math.abs(velocityX) < 0.5) {
      isDragging.current = false;

      const offsetX = contentOffset.x;
      const newIndex = Math.round(offsetX / SCREEN_WIDTH);
      const clampedIndex = Math.max(0, Math.min(newIndex, tabCount - 1));

      if (clampedIndex !== currentIndexRef.current) {
        currentIndexRef.current = clampedIndex;
        onIndexChange(clampedIndex);
      }
    }
  }, [onIndexChange, tabCount]);

  // Render des tabs
  const renderedTabs = useMemo(() => {
    return children.map((child, index) => (
      <View key={index} style={styles.tabContainer}>
        {child}
      </View>
    ));
  }, [children]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={enabled}
        bounces={Platform.OS === 'ios'}
        decelerationRate="fast"
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
        // Permettre le scroll vertical dans les enfants
        nestedScrollEnabled={true}
        // Android optimizations
        overScrollMode="never"
        // iOS optimization
        directionalLockEnabled={true}
        contentContainerStyle={styles.scrollContent}
        // Assurer que le scroll programmé fonctionne
        keyboardShouldPersistTaps="handled"
      >
        {renderedTabs}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    flexDirection: 'row',
  },
  tabContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
});
