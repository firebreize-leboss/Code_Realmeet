// components/signup/steps/Step5Intention.tsx
// Étape 5: Ce que je recherche (intention)

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { useSignup } from '@/contexts/SignupContext';
import { UserIntention, INTENTION_OPTIONS } from '@/lib/database.types';
import { colors, spacing, typography, borderRadius, shadows } from '@/styles/commonStyles';

export function Step5Intention() {
  const { formData, updateFormData, getStepErrors } = useSignup();
  const errors = getStepErrors(5);

  const handleSelect = (value: UserIntention) => {
    updateFormData('intention', value);
  };

  return (
    <View style={styles.container}>
      {/* Titre et description */}
      <View style={styles.header}>
        <Text style={styles.title}>Qu'est-ce qui vous amène ici ?</Text>
        <Text style={styles.subtitle}>
          Cela nous aide à vous proposer des activités adaptées
        </Text>
      </View>

      {/* Options d'intention */}
      <View style={styles.optionsContainer}>
        {INTENTION_OPTIONS.map((option) => {
          const isSelected = formData.intention === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionCard,
                isSelected && { borderColor: colors.primaryMuted, backgroundColor: colors.primaryLight },
              ]}
              onPress={() => handleSelect(option.value as UserIntention)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isSelected && { backgroundColor: colors.primaryLight }]}>
                <IconSymbol
                  name={option.icon as any}
                  size={28}
                  color={isSelected ? colors.primary : colors.textTertiary}
                />
              </View>

              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionLabel,
                  isSelected && { color: colors.primary, fontWeight: typography.bold },
                ]}>
                  {option.label}
                </Text>
                <Text style={styles.optionDescription}>
                  {option.value === 'amicaux'
                    ? 'Rencontrer de nouvelles personnes, élargir mon cercle social'
                    : 'Trouver une relation amoureuse, rencontrer quelqu\'un de spécial'
                  }
                </Text>
              </View>

              {isSelected && (
                <View style={styles.checkmark}>
                  <IconSymbol name="checkmark" size={16} color={colors.textOnPrimary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {errors.intention && (
        <Text style={styles.errorText}>{errors.intention}</Text>
      )}

      {/* Note */}
      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          Vous pourrez modifier ce choix à tout moment depuis vos paramètres
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: 26,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: spacing.lg,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.borderLight,
    gap: spacing.lg,
    ...shadows.sm,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
    gap: spacing.xs,
  },
  optionLabel: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  optionDescription: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  noteCard: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: spacing.lg,
  },
  noteText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
