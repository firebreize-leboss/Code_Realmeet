// components/RatingStars.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface RatingStarsProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  color?: string;
}

export default function RatingStars({
  rating,
  size = 20,
  interactive = false,
  onRatingChange,
  color = '#FFD700',
}: RatingStarsProps) {
  const handlePress = (index: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(index + 1);
    }
  };

  const stars = [];
  for (let i = 0; i < 5; i++) {
    const isFilled = i < Math.floor(rating);
    const isHalf = !isFilled && i < rating && rating - i >= 0.5;

    const starElement = (
      <IconSymbol
        key={i}
        name={isFilled ? 'star.fill' : isHalf ? 'star.leadinghalf.filled' : 'star'}
        size={size}
        color={isFilled || isHalf ? color : colors.textSecondary}
      />
    );

    if (interactive) {
      stars.push(
        <TouchableOpacity key={i} onPress={() => handlePress(i)} activeOpacity={0.7}>
          {starElement}
        </TouchableOpacity>
      );
    } else {
      stars.push(starElement);
    }
  }

  return <View style={styles.container}>{stars}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
});