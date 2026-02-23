// components/signup/SignupHeader.tsx
// Header réutilisable pour les étapes du wizard

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, typography, borderRadius } from '@/styles/commonStyles';
import { SignupProgressBar } from './SignupProgressBar';

interface SignupHeaderProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onClose?: () => void;
  showBack?: boolean;
}

export function SignupHeader({
  currentStep,
  totalSteps,
  onBack,
  onClose,
  showBack = true,
}: SignupHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}

        <Text style={styles.stepIndicator}>
          {currentStep} / {totalSteps}
        </Text>

        {onClose ? (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="xmark" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <SignupProgressBar currentStep={currentStep} totalSteps={totalSteps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },
  spacer: {
    width: 36,
  },
});
