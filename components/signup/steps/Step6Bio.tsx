// components/signup/steps/Step6Bio.tsx
// Étape 6: Bio (présentation personnelle)

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useSignup } from '@/contexts/SignupContext';
import { colors, spacing, typography, borderRadius } from '@/styles/commonStyles';

const MAX_BIO_LENGTH = 200;

// Suggestions de prompts pour aider l'utilisateur
const BIO_PROMPTS = [
  'Passionné(e) de...',
  'J\'aime...',
  'À la recherche de...',
  'Fan de...',
];

export function Step6Bio() {
  const { formData, updateFormData } = useSignup();
  const [isFocused, setIsFocused] = useState(false);

  const remainingChars = MAX_BIO_LENGTH - formData.bio.length;
  const isNearLimit = remainingChars <= 20;

  return (
    <View style={styles.container}>
      {/* Titre et description */}
      <View style={styles.header}>
        <Text style={styles.title}>Parlez-nous de vous</Text>
        <Text style={styles.subtitle}>
          Quelques mots pour vous présenter aux autres membres
        </Text>
      </View>

      {/* Textarea bio */}
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bio</Text>
          <View
            style={[
              styles.textAreaContainer,
              isFocused && styles.textAreaFocused,
            ]}
          >
            <TextInput
              style={styles.textArea}
              placeholder="Ex: Passionné de randonnée et de photographie, j'aime découvrir de nouveaux endroits et rencontrer des gens authentiques..."
              placeholderTextColor={colors.textMuted}
              value={formData.bio}
              onChangeText={(text) => {
                if (text.length <= MAX_BIO_LENGTH) {
                  updateFormData('bio', text);
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={MAX_BIO_LENGTH}
            />
          </View>
          <View style={styles.charCountContainer}>
            <Text style={styles.optionalBadge}>Optionnel</Text>
            <Text
              style={[
                styles.charCount,
                isNearLimit && styles.charCountWarning,
              ]}
            >
              {remainingChars} caractères restants
            </Text>
          </View>
        </View>
      </View>

      {/* Conseils */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Quelques idées</Text>
        <View style={styles.promptsContainer}>
          {BIO_PROMPTS.map((prompt, index) => (
            <View key={index} style={styles.promptBadge}>
              <Text style={styles.promptText}>{prompt}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Note */}
      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          Une bio bien rédigée augmente vos chances de faire des rencontres
          intéressantes. Soyez authentique !
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
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  textAreaContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  textAreaFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundAlt,
  },
  textArea: {
    padding: spacing.lg,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  charCountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  optionalBadge: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  charCount: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  charCountWarning: {
    color: colors.warning,
  },
  tipsCard: {
    marginTop: spacing.xxl,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tipsTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
  },
  promptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  promptBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  promptText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.primary,
  },
  noteCard: {
    marginTop: spacing.xl,
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
