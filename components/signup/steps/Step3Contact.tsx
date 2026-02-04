// components/signup/steps/Step3Contact.tsx
// Étape 3: Email et téléphone

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SignupInput } from '../SignupInput';
import { useSignup } from '@/contexts/SignupContext';
import { colors, spacing, typography } from '@/styles/commonStyles';

export function Step3Contact() {
  const { formData, updateFormData, getStepErrors } = useSignup();
  const errors = getStepErrors(3);

  return (
    <View style={styles.container}>
      {/* Titre et description */}
      <View style={styles.header}>
        <Text style={styles.title}>Comment vous contacter ?</Text>
        <Text style={styles.subtitle}>
          Votre email servira à vous connecter et récupérer votre compte
        </Text>
      </View>

      {/* Champs contact */}
      <View style={styles.form}>
        <SignupInput
          label="Adresse email"
          required
          icon="envelope"
          placeholder="votre.email@exemple.com"
          value={formData.email}
          onChangeText={(text) => updateFormData('email', text.toLowerCase().trim())}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
        />

        <SignupInput
          label="Téléphone"
          icon="phone.fill"
          placeholder="+33 6 12 34 56 78"
          value={formData.phone}
          onChangeText={(text) => updateFormData('phone', text)}
          error={errors.phone}
          helper="Optionnel — pour les notifications importantes"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
      </View>

      {/* Note de confidentialité */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyText}>
          Vos informations de contact restent privées et ne seront jamais partagées
          avec d'autres utilisateurs.
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
  privacyNote: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.lg,
  },
  privacyText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
