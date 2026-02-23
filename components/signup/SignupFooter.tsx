// components/signup/SignupFooter.tsx
// Footer avec boutons CTA pour les étapes du wizard

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/styles/commonStyles';

interface SignupFooterProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  hint?: string;
}

export function SignupFooter({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  hint,
}: SignupFooterProps) {
  return (
    <View style={styles.container}>
      {hint && <Text style={styles.hint}>{hint}</Text>}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          primaryDisabled && styles.primaryButtonDisabled,
        ]}
        onPress={onPrimary}
        disabled={primaryDisabled || primaryLoading}
        activeOpacity={0.8}
      >
        {primaryLoading ? (
          <ActivityIndicator color={colors.textOnPrimary} size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        )}
      </TouchableOpacity>

      {secondaryLabel && onSecondary && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSecondary}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.backgroundAlt,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: spacing.md,
  },
  hint: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.primaryMuted,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadows.sm,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.borderLight,
  },
  primaryButtonText: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.textOnPrimary,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },
});
