// components/signup/steps/Step4City.tsx
// Étape 4: Sélection de la ville

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { SignupInput } from '../SignupInput';
import { useSignup } from '@/contexts/SignupContext';
import { colors, spacing, typography, borderRadius } from '@/styles/commonStyles';

// Villes populaires en France
const POPULAR_CITIES = [
  'Paris',
  'Lyon',
  'Marseille',
  'Toulouse',
  'Bordeaux',
  'Lille',
  'Nantes',
  'Nice',
  'Strasbourg',
  'Montpellier',
  'Rennes',
  'Grenoble',
];

export function Step4City() {
  const { formData, updateFormData, getStepErrors } = useSignup();
  const errors = getStepErrors(4);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const handleCitySelect = (city: string) => {
    updateFormData('city', city);
    setShowSuggestions(false);
  };

  const handleInputChange = (text: string) => {
    updateFormData('city', text);
    setShowSuggestions(text.length === 0);
  };

  // Filtrer les villes si l'utilisateur tape
  const filteredCities = formData.city.length > 0
    ? POPULAR_CITIES.filter(city =>
        city.toLowerCase().includes(formData.city.toLowerCase())
      )
    : POPULAR_CITIES;

  return (
    <View style={styles.container}>
      {/* Titre et description */}
      <View style={styles.header}>
        <Text style={styles.title}>Où habitez-vous ?</Text>
        <Text style={styles.subtitle}>
          Nous vous proposerons des activités près de chez vous
        </Text>
      </View>

      {/* Champ ville */}
      <View style={styles.form}>
        <SignupInput
          label="Ville"
          required
          icon="location.fill"
          placeholder="Entrez votre ville"
          value={formData.city}
          onChangeText={handleInputChange}
          error={errors.city}
          autoCapitalize="words"
          onFocus={() => setShowSuggestions(true)}
        />

        {/* Suggestions de villes */}
        {showSuggestions && filteredCities.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Villes populaires</Text>
            <View style={styles.citiesGrid}>
              {filteredCities.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.cityChip,
                    formData.city === city && styles.cityChipSelected,
                  ]}
                  onPress={() => handleCitySelect(city)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cityChipText,
                      formData.city === city && styles.cityChipTextSelected,
                    ]}
                  >
                    {city}
                  </Text>
                  {formData.city === city && (
                    <IconSymbol name="checkmark" size={14} color={colors.textOnPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
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
    gap: spacing.xl,
  },
  suggestionsContainer: {
    gap: spacing.md,
  },
  suggestionsTitle: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  citiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cityChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cityChipText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  cityChipTextSelected: {
    color: colors.textOnPrimary,
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
