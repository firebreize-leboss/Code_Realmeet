// components/signup/steps/StepReview.tsx
// Écran de récapitulatif avant création du compte

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { useSignup, TOTAL_STEPS } from '@/contexts/SignupContext';
import { getIntentionLabel } from '@/lib/database.types';
import { colors, spacing, typography, borderRadius, shadows } from '@/styles/commonStyles';

interface StepReviewProps {
  onEditStep: (step: number) => void;
}

export function StepReview({ onEditStep }: StepReviewProps) {
  const { formData } = useSignup();

  // Calculer l'âge
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

  const renderEditButton = (step: number) => (
    <TouchableOpacity
      style={styles.editButton}
      onPress={() => onEditStep(step)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <IconSymbol name="pencil" size={14} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Titre */}
      <View style={styles.header}>
        <Text style={styles.title}>Vérifiez vos informations</Text>
        <Text style={styles.subtitle}>
          Tout est correct ? Vous pourrez modifier ces informations plus tard
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profil principal */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {formData.profileImage ? (
              <Image
                source={{ uri: formData.profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <IconSymbol name="person.fill" size={32} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {formData.firstName} {formData.lastName}
              </Text>
              <Text style={styles.profileMeta}>
                {getAge()} ans • {formData.city}
              </Text>
            </View>
            {renderEditButton(1)}
          </View>

          {formData.bio && (
            <View style={styles.bioSection}>
              <Text style={styles.bioText}>{formData.bio}</Text>
            </View>
          )}
        </View>

        {/* Informations détaillées */}
        <View style={styles.detailsContainer}>
          {/* Date de naissance */}
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <View style={styles.detailIcon}>
                <IconSymbol name="calendar" size={16} color={colors.textTertiary} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Date de naissance</Text>
                <Text style={styles.detailValue}>{formData.birthDate}</Text>
              </View>
            </View>
            {renderEditButton(2)}
          </View>

          {/* Email */}
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <View style={styles.detailIcon}>
                <IconSymbol name="envelope" size={16} color={colors.textTertiary} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{formData.email}</Text>
              </View>
            </View>
            {renderEditButton(3)}
          </View>

          {/* Téléphone */}
          {formData.phone && (
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={styles.detailIcon}>
                  <IconSymbol name="phone.fill" size={16} color={colors.textTertiary} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Téléphone</Text>
                  <Text style={styles.detailValue}>{formData.phone}</Text>
                </View>
              </View>
              {renderEditButton(3)}
            </View>
          )}

          {/* Intention */}
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <View style={styles.detailIcon}>
                <IconSymbol name="heart.fill" size={16} color={colors.textTertiary} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Je recherche</Text>
                <Text style={styles.detailValue}>
                  {getIntentionLabel(formData.intention)}
                </Text>
              </View>
            </View>
            {renderEditButton(5)}
          </View>

          {/* Intérêts */}
          {formData.interests.length > 0 && (
            <View style={styles.interestsSection}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailLabel}>Centres d'intérêt</Text>
                {renderEditButton(7)}
              </View>
              <View style={styles.interestsTags}>
                {formData.interests.map((interest) => (
                  <View key={interest} style={styles.interestTag}>
                    <Text style={styles.interestTagText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Note sécurité */}
        <View style={styles.securityNote}>
          <IconSymbol name="lock.shield" size={18} color={colors.success} />
          <Text style={styles.securityText}>
            Vos données sont sécurisées et ne seront jamais partagées sans votre accord
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profilePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  profileMeta: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
  },
  bioSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  bioText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  detailsContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  interestsSection: {
    paddingTop: spacing.md,
  },
  interestsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  interestTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  interestTagText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_500Medium',
    color: colors.primary,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  securityText: {
    flex: 1,
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.success,
    lineHeight: 18,
  },
});
