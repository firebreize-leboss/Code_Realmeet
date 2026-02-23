// components/signup/SignupProgressBar.tsx
// Barre de progression discrète pour le wizard d'inscription

import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, borderRadius } from '@/styles/commonStyles';
import { TOTAL_STEPS } from '@/contexts/SignupContext';

interface SignupProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

export function SignupProgressBar({
  currentStep,
  totalSteps = TOTAL_STEPS
}: SignupProgressBarProps) {
  const progress = currentStep / totalSteps;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View
          style={[
            styles.progress,
            { width: `${progress * 100}%` }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  track: {
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    backgroundColor: colors.primaryMuted,
    borderRadius: borderRadius.full,
  },
});
