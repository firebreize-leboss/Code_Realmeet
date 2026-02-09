// components/MessageSendAnimation.tsx
// Animation "Instagram DM" pour l'envoi de messages
// Smooth translation animation avec Reanimated pour 60fps

import React, { useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design system colors (same as chat-detail)
const COLORS = {
  orangePrimary: '#E07A3D',
  white: '#FFFFFF',
};

// Animation timing - Instagram DM style: fast and smooth
const ANIMATION_DURATION = 200; // 200ms total, ease-out for snappy feel

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
  // Animation progress 0 -> 1
  const progress = useSharedValue(0);

  const handleComplete = useCallback(() => {
    onAnimationComplete();
  }, [onAnimationComplete]);

  const handleStart = useCallback(() => {
    onAnimationStart?.();
  }, [onAnimationStart]);

  useEffect(() => {
    if (visible) {
      // Reset progress
      progress.value = 0;

      // Notify that animation is starting
      runOnJS(handleStart)();

      // Animate progress from 0 to 1 with ease-out timing
      progress.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(handleComplete)();
        }
      });
    }
  }, [visible, handleComplete, handleStart]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    // Interpolate position from start to end
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [startPosition.x, endPosition.x]
    );
    const translateY = interpolate(
      progress.value,
      [0, 1],
      [startPosition.y, endPosition.y]
    );

    // Scale: start slightly smaller (1.0), animate to 0.98 at end
    const scale = interpolate(
      progress.value,
      [0, 0.7, 1],
      [1.0, 0.99, 0.98]
    );

    // Opacity: full opacity during movement, fade at the very end
    const opacity = interpolate(
      progress.value,
      [0, 0.8, 1],
      [1, 1, 0]
    );

    // Width interpolation for smooth size transition
    const width = interpolate(
      progress.value,
      [0, 1],
      [startPosition.width, endPosition.width]
    );

    return {
      position: 'absolute',
      left: translateX,
      top: translateY,
      width: width,
      maxWidth: SCREEN_WIDTH * 0.75,
      transform: [{ scale }],
      opacity,
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
