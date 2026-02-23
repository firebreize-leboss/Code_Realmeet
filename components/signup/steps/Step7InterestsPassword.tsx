// components/signup/steps/Step7InterestsPassword.tsx
// Étape 7: Centres d'intérêts + Mot de passe

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { SignupInput } from '../SignupInput';
import { useSignup } from '@/contexts/SignupContext';
import { colors, spacing, typography, borderRadius } from '@/styles/commonStyles';

const ALL_INTERESTS = [
  'Sport', 'Musique', 'Cinéma', 'Lecture', 'Voyage',
  'Cuisine', 'Photographie', 'Dessin', 'Danse', 'Gaming',
  'Technologie', 'Mode', 'Art', 'Fitness', 'Yoga',
  'Randonnée', 'Natation', 'Football', 'Basketball', 'Tennis',
  'Guitare', 'Piano', 'Chant', 'Théâtre', 'Écriture',
  'Jardinage', 'Peinture', 'Sculpture', 'Astronomie', 'Science',
  'Histoire', 'Langues'
];

const MAX_INTERESTS = 5;

export function Step7InterestsPassword() {
  const { formData, updateFormData, getStepErrors } = useSignup();
  const errors = getStepErrors(7);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleInterest = (interest: string) => {
    if (formData.interests.includes(interest)) {
      updateFormData('interests', formData.interests.filter(i => i !== interest));
    } else if (formData.interests.length < MAX_INTERESTS) {
      updateFormData('interests', [...formData.interests, interest]);
    }
  };

  // Filtrer les intérêts selon la recherche
  const filteredInterests = searchQuery
    ? ALL_INTERESTS.filter(i =>
        i.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_INTERESTS;

  // Calculer la force du mot de passe
  const getPasswordStrength = (): { level: number; label: string; color: string } => {
    const pwd = formData.password;
    if (!pwd) return { level: 0, label: '', color: colors.borderLight };

    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    if (strength <= 2) return { level: 1, label: 'Faible', color: colors.error };
    if (strength <= 3) return { level: 2, label: 'Moyen', color: colors.warning };
    return { level: 3, label: 'Fort', color: colors.success };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <View style={styles.container}>
      {/* Titre */}
      <View style={styles.header}>
        <Text style={styles.title}>Dernière étape !</Text>
        <Text style={styles.subtitle}>
          Vos centres d'intérêt et un mot de passe sécurisé
        </Text>
      </View>

      {/* Section Intérêts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Centres d'intérêt</Text>
          <Text style={styles.sectionCount}>
            {formData.interests.length} / {MAX_INTERESTS}
          </Text>
        </View>

        {/* Intérêts sélectionnés */}
        {formData.interests.length > 0 && (
          <View style={styles.selectedInterests}>
            {formData.interests.map((interest) => (
              <TouchableOpacity
                key={interest}
                style={styles.selectedChip}
                onPress={() => toggleInterest(interest)}
              >
                <Text style={styles.selectedChipText}>{interest}</Text>
                <IconSymbol name="xmark" size={12} color={colors.textOnPrimary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recherche */}
        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Grille d'intérêts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.interestsScroll}
        >
          <View style={styles.interestsGrid}>
            {filteredInterests.map((interest) => {
              const isSelected = formData.interests.includes(interest);
              const isDisabled = !isSelected && formData.interests.length >= MAX_INTERESTS;

              return (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    isSelected && styles.interestChipSelected,
                    isDisabled && styles.interestChipDisabled,
                  ]}
                  onPress={() => toggleInterest(interest)}
                  disabled={isDisabled}
                >
                  <Text
                    style={[
                      styles.interestChipText,
                      isSelected && styles.interestChipTextSelected,
                      isDisabled && styles.interestChipTextDisabled,
                    ]}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={styles.interestHint}>
          Optionnel — Sélectionnez jusqu'à 5 centres d'intérêt
        </Text>
      </View>

      {/* Section Mot de passe */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sécurité</Text>

        <View style={styles.passwordFields}>
          <SignupInput
            label="Mot de passe"
            required
            icon="lock.fill"
            placeholder="••••••••"
            value={formData.password}
            onChangeText={(text) => updateFormData('password', text)}
            error={errors.password}
            secureToggle
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Indicateur de force */}
          {formData.password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
                {[1, 2, 3].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.strengthBar,
                      level <= passwordStrength.level && {
                        backgroundColor: passwordStrength.color,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                {passwordStrength.label}
              </Text>
            </View>
          )}

          <SignupInput
            label="Confirmer le mot de passe"
            required
            icon="lock.fill"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChangeText={(text) => updateFormData('confirmPassword', text)}
            error={errors.confirmPassword}
            secureToggle
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
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
  section: {
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  sectionCount: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.primary,
  },
  selectedInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  selectedChipText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textOnPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.text,
  },
  interestsScroll: {
    paddingVertical: spacing.xs,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    maxWidth: 500,
  },
  interestChip: {
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  interestChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  interestChipDisabled: {
    opacity: 0.4,
  },
  interestChipText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  interestChipTextSelected: {
    color: colors.primary,
  },
  interestChipTextDisabled: {
    color: colors.textMuted,
  },
  interestHint: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  passwordFields: {
    gap: spacing.lg,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: -spacing.sm,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  strengthBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
  },
  strengthLabel: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_500Medium',
  },
});
