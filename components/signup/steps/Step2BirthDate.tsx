// components/signup/steps/Step2BirthDate.tsx
// Étape 2: Date de naissance

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SignupInput } from '../SignupInput';
import { useSignup } from '@/contexts/SignupContext';
import { colors, spacing, typography } from '@/styles/commonStyles';

export function Step2BirthDate() {
  const { formData, updateFormData, getStepErrors } = useSignup();
  const errors = getStepErrors(2);

  // Formater la date au fur et à mesure de la saisie
  const handleDateChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = '';
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 2);
      if (cleaned.length > 2) {
        formatted += '/' + cleaned.substring(2, 4);
      }
      if (cleaned.length > 4) {
        formatted += '/' + cleaned.substring(4, 8);
      }
    }
    updateFormData('birthDate', formatted);
  };

  // Calculer l'âge si date valide
  const getAge = () => {
    if (formData.birthDate.length === 10) {
      const [day, month, year] = formData.birthDate.split('/').map(Number);
      const today = new Date();
      const birthDate = new Date(year, month - 1, day);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
    return null;
  };

  const age = getAge();
  const isValidAge = age !== null && age >= 18;

  return (
    <View style={styles.container}>
      {/* Titre et description */}
      <View style={styles.header}>
        <Text style={styles.title}>Quelle est votre date de naissance ?</Text>
        <Text style={styles.subtitle}>
          RealMeet est réservé aux personnes majeures
        </Text>
      </View>

      {/* Champ date */}
      <View style={styles.form}>
        <SignupInput
          label="Date de naissance"
          required
          icon="calendar"
          placeholder="JJ/MM/AAAA"
          value={formData.birthDate}
          onChangeText={handleDateChange}
          error={errors.birthDate}
          keyboardType="numeric"
          maxLength={10}
        />

        {/* Affichage de l'âge calculé */}
        {age !== null && (
          <View style={[styles.ageCard, isValidAge ? styles.ageCardValid : styles.ageCardInvalid]}>
            <Text style={[styles.ageNumber, isValidAge ? styles.ageNumberValid : styles.ageNumberInvalid]}>
              {age}
            </Text>
            <Text style={[styles.ageLabel, isValidAge ? styles.ageLabelValid : styles.ageLabelInvalid]}>
              ans
            </Text>
          </View>
        )}
      </View>

      {/* Information légale */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Votre âge sera visible sur votre profil. Nous utilisons cette information
          pour vous proposer des activités adaptées.
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
  ageCard: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    gap: spacing.sm,
  },
  ageCardValid: {
    backgroundColor: colors.successLight,
  },
  ageCardInvalid: {
    backgroundColor: colors.errorLight,
  },
  ageNumber: {
    fontSize: 48,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: -1,
  },
  ageNumberValid: {
    color: colors.success,
  },
  ageNumberInvalid: {
    color: colors.error,
  },
  ageLabel: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
  },
  ageLabelValid: {
    color: colors.success,
  },
  ageLabelInvalid: {
    color: colors.error,
  },
  infoCard: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: spacing.lg,
  },
  infoText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
