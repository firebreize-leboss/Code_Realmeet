// components/signup/steps/Step4City.tsx
// Étape 4: Sélection de la ville via autocomplétion API

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import { useSignup } from '@/contexts/SignupContext';
import { colors, spacing, typography } from '@/styles/commonStyles';

export function Step4City() {
  const { formData, updateFormData, updateMultipleFields, getStepErrors } = useSignup();
  const errors = getStepErrors(4);

  const handleCitySelect = (result: {
    city: string;
    postcode: string;
    latitude: number;
    longitude: number;
    displayName: string;
  }) => {
    updateMultipleFields({
      city: result.city,
      citySelected: true,
    });
  };

  const handleCityChange = () => {
    updateMultipleFields({
      city: '',
      citySelected: false,
    });
  };

  return (
    <View style={styles.container}>
      {/* Titre et description */}
      <View style={styles.header}>
        <Text style={styles.title}>Où habitez-vous ?</Text>
        <Text style={styles.subtitle}>
          Nous vous proposerons des activités près de chez vous
        </Text>
      </View>

      {/* Champ ville avec autocomplétion */}
      <View style={styles.form}>
        <CityAutocomplete
          value={formData.city}
          onCitySelect={handleCitySelect}
          onCityChange={handleCityChange}
          placeholder="Rechercher une ville..."
          label="Ville *"
          error={errors.city}
        />
      </View>

      {/* Note */}
      <View style={styles.noteCard}>
        <IconSymbol name="info.circle" size={18} color={colors.textTertiary} />
        <Text style={styles.noteText}>
          Vous pourrez modifier votre ville à tout moment depuis votre profil
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
  form: {
    zIndex: 1000,
  },
  noteCard: {
    marginTop: spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.md,
  },
  noteText: {
    flex: 1,
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    lineHeight: 20,
  },
});
