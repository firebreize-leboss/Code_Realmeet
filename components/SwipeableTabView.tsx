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

// DEBUG: Logs pour diagnostiquer le swipe sur iOS
const DEBUG_SWIPE = true;
const log = (context: string, ...args: any[]) => {
  if (DEBUG_SWIPE) {
    console.log(`[SwipeableTabView][${Platform.OS}][${context}]`, ...args);
  }
};

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

  // Log initial et quand les props changent
  useEffect(() => {
    log('PROPS', {
      currentIndex,
      enabled,
      tabCount,
      SCREEN_WIDTH,
      Platform: Platform.OS,
      Version: Platform.Version,
    });
  }, [currentIndex, enabled, tabCount]);

  // Initial scroll au bon index après le layout
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    log('onLayout', { width, height, isLayoutReady, currentIndex, SCREEN_WIDTH });

    if (!isLayoutReady) {
      setIsLayoutReady(true);
      // Scroll immédiat sans animation pour l'initialisation
      if (currentIndex > 0 && scrollViewRef.current) {
        log('onLayout', 'Initial scroll to index', currentIndex);
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
    log('useEffect[currentIndex]', {
      currentIndex,
      currentIndexRef: currentIndexRef.current,
      isLayoutReady,
      hasScrollViewRef: !!scrollViewRef.current,
      isDragging: isDragging.current,
    });

    if (!isLayoutReady || !scrollViewRef.current) {
      log('useEffect[currentIndex]', 'SKIPPED - layout not ready or no scrollView ref');
      return;
    }

    // Toujours mettre à jour currentIndexRef pour suivre les changements externes
    if (currentIndex !== currentIndexRef.current) {
      // Ne pas scroller si on est en train de drag
      if (isDragging.current) {
        log('useEffect[currentIndex]', 'SKIPPED - user is dragging');
        currentIndexRef.current = currentIndex;
        return;
      }

      log('useEffect[currentIndex]', `Programmatic scroll from ${currentIndexRef.current} to ${currentIndex}`);
      currentIndexRef.current = currentIndex;
      isScrollingProgrammatically.current = true;

      // Scroll animé vers le nouvel index - utilise la méthode native scrollTo
      // Petit délai pour assurer que la ref est prête sur Android
      requestAnimationFrame(() => {
        if (scrollViewRef.current) {
          const targetX = currentIndex * SCREEN_WIDTH;
          log('useEffect[currentIndex]', `scrollTo x=${targetX}`);
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
        log('useEffect[currentIndex]', 'isScrollingProgrammatically reset to false');
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, isLayoutReady]);

  // Handler quand le scroll se termine après un drag (avec momentum)
  const onMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    const clampedIndex = Math.max(0, Math.min(newIndex, tabCount - 1));

    log('onMomentumScrollEnd', {
      offsetX,
      newIndex,
      clampedIndex,
      currentIndexRef: currentIndexRef.current,
      isScrollingProgrammatically: isScrollingProgrammatically.current,
      isDragging: isDragging.current,
    });

    isDragging.current = false;

    if (isScrollingProgrammatically.current) {
      log('onMomentumScrollEnd', 'SKIPPED - programmatic scroll');
      return;
    }

    if (clampedIndex !== currentIndexRef.current) {
      log('onMomentumScrollEnd', `Index change: ${currentIndexRef.current} -> ${clampedIndex}`);
      currentIndexRef.current = clampedIndex;
      onIndexChange(clampedIndex);
    } else {
      log('onMomentumScrollEnd', 'No index change needed');
    }
  }, [onIndexChange, tabCount]);

  // Handler pour le début du drag
  const onScrollBeginDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    log('onScrollBeginDrag', {
      offsetX,
      currentIndexRef: currentIndexRef.current,
      enabled,
    });
    isDragging.current = true;
    isScrollingProgrammatically.current = false;
  }, [enabled]);

  // Handler pour tracker la position du scroll (utilisé pour iOS)
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // Log moins fréquent pour éviter le spam (seulement les positions clés)
    if (Math.abs(contentOffset.x - lastOffsetX.current) > 50 || contentOffset.x === 0) {
      log('onScroll', {
        offsetX: contentOffset.x,
        contentWidth: contentSize.width,
        layoutWidth: layoutMeasurement.width,
        isDragging: isDragging.current,
        isScrollingProgrammatically: isScrollingProgrammatically.current,
      });
    }
    lastOffsetX.current = contentOffset.x;
  }, []);

  // Handler pour la fin du drag (avant momentum)
  const onScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, velocity } = event.nativeEvent;
    log('onScrollEndDrag', {
      offsetX: contentOffset.x,
      velocity: velocity?.x,
      isDragging: isDragging.current,
      currentIndexRef: currentIndexRef.current,
      lastOffsetX: lastOffsetX.current,
    });

    // Sur iOS avec pagingEnabled, onMomentumScrollEnd n'est pas toujours appelé
    // On utilise un timeout pour lire la position finale après l'animation de paging
    if (Platform.OS === 'ios') {
      log('onScrollEndDrag[iOS]', 'Starting iOS-specific timeout handler');
      setTimeout(() => {
        log('onScrollEndDrag[iOS-timeout]', {
          isDragging: isDragging.current,
          lastOffsetX: lastOffsetX.current,
          currentIndexRef: currentIndexRef.current,
        });

        if (!isDragging.current) {
          log('onScrollEndDrag[iOS-timeout]', 'SKIPPED - isDragging is false');
          return;
        }
        isDragging.current = false;

        // Utiliser la dernière position enregistrée par onScroll
        const newIndex = Math.round(lastOffsetX.current / SCREEN_WIDTH);
        const clampedIndex = Math.max(0, Math.min(newIndex, tabCount - 1));

        log('onScrollEndDrag[iOS-timeout]', {
          newIndex,
          clampedIndex,
          SCREEN_WIDTH,
          willChangeIndex: clampedIndex !== currentIndexRef.current,
        });

        if (clampedIndex !== currentIndexRef.current) {
          log('onScrollEndDrag[iOS-timeout]', `Index change: ${currentIndexRef.current} -> ${clampedIndex}`);
          currentIndexRef.current = clampedIndex;
          onIndexChange(clampedIndex);
        }
      }, 350); // Attendre que l'animation de paging soit terminée
      return;
    }

    // Android: Vérifier si le momentum sera déclenché
    const velocityX = velocity?.x ?? 0;
    log('onScrollEndDrag[Android]', { velocityX, willHandleHere: Math.abs(velocityX) < 0.5 });

    // Si pas de velocity significative, onMomentumScrollEnd peut ne pas être appelé
    // donc on gère le changement ici
    if (Math.abs(velocityX) < 0.5) {
      isDragging.current = false;

      const offsetX = contentOffset.x;
      const newIndex = Math.round(offsetX / SCREEN_WIDTH);
      const clampedIndex = Math.max(0, Math.min(newIndex, tabCount - 1));

      if (clampedIndex !== currentIndexRef.current) {
        log('onScrollEndDrag[Android]', `Index change: ${currentIndexRef.current} -> ${clampedIndex}`);
        currentIndexRef.current = clampedIndex;
        onIndexChange(clampedIndex);
      }
    }
  }, [onIndexChange, tabCount]);

  // Render des tabs
  const renderedTabs = useMemo(() => {
    log('renderedTabs', { tabCount: children.length });
    return children.map((child, index) => (
      <View key={index} style={styles.tabContainer}>
        {child}
      </View>
    ));
  }, [children]);

  // Log quand le composant est rendu
  log('RENDER', {
    isLayoutReady,
    currentIndex,
    enabled,
    tabCount,
  });

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
