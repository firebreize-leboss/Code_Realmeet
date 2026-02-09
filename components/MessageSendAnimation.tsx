// components/MessageSendAnimation.tsx
// Animation "Instagram DM" pour l'envoi de messages
// Smooth spring animation avec Reanimated 2/3 pour 60fps

import React, { useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design system colors (same as chat-detail)
const COLORS = {
  orangePrimary: '#E07A3D',
  white: '#FFFFFF',
};

// Spring configurations optimisées pour une animation très subtile type Instagram
// Instagram utilise une animation quasi-imperceptible: micro scale + fade rapide
const SPRING_CONFIG = {
  // Config pour le scale très subtil (pas d'overshoot visible)
  scale: {
    damping: 28,
    stiffness: 400,
    mass: 0.4,
    overshootClamping: true,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
  },
};

export interface AnimationStartPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnimationEndPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MessageSendAnimationProps {
  visible: boolean;
  message: string;
  imageUrl?: string;
  startPosition: AnimationStartPosition;
  endPosition: AnimationEndPosition;
  onAnimationComplete: () => void;
  onAnimationStart?: () => void;
}

const MessageSendAnimation: React.FC<MessageSendAnimationProps> = memo(({
  visible,
  message,
  imageUrl,
  startPosition,
  endPosition,
  onAnimationComplete,
  onAnimationStart,
}) => {
  // Shared values for animation - Instagram style: très subtil
  // On anime directement à la position finale, pas de translation
  const scale = useSharedValue(0.96);
  const opacity = useSharedValue(0);

  const handleComplete = useCallback(() => {
    onAnimationComplete();
  }, [onAnimationComplete]);

  const handleStart = useCallback(() => {
    onAnimationStart?.();
  }, [onAnimationStart]);

  useEffect(() => {
    if (visible) {
      // Reset - Instagram style: commence presque à la taille finale
      scale.value = 0.96;
      opacity.value = 0;

      // Notify that animation is starting
      runOnJS(handleStart)();

      // === Animation Instagram: très subtile et rapide ===
      // Fade in instantané (50ms)
      opacity.value = withTiming(1, {
        duration: 50,
        easing: Easing.out(Easing.ease)
      });

      // Micro scale: 0.96 -> 1.0 (à peine perceptible)
      scale.value = withSpring(1.0, SPRING_CONFIG.scale, (finished) => {
        if (finished) {
          // Fade out rapide après un court délai
          opacity.value = withDelay(
            40,
            withTiming(0, {
              duration: 80,
              easing: Easing.in(Easing.ease)
            }, (fadeFinished) => {
              if (fadeFinished) {
                runOnJS(handleComplete)();
              }
            })
          );
        }
      });
    }
  }, [visible, endPosition, handleComplete, handleStart]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      // Position directement à la destination finale (pas de mouvement)
      right: 16,
      bottom: 0,
      transform: [
        { scale: scale.value },
      ],
      opacity: opacity.value,
      maxWidth: SCREEN_WIDTH * 0.75,
    };
  });

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlayContainer} pointerEvents="none">
      <Animated.View style={[styles.bubble, animatedContainerStyle]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.messageImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.messageText} numberOfLines={10}>
            {message}
          </Text>
        )}
      </Animated.View>
    </View>
  );
});

MessageSendAnimation.displayName = 'MessageSendAnimation';

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'none',
  },
  bubble: {
    backgroundColor: COLORS.orangePrimary,
    borderRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    // Pas d'ombre - animation subtile type Instagram
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.white,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
});

export default MessageSendAnimation;
