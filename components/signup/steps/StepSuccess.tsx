// components/signup/steps/StepSuccess.tsx
// Écran de confirmation après création du compte

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { useSignup } from '@/contexts/SignupContext';
import { colors, spacing, typography, borderRadius, shadows } from '@/styles/commonStyles';

export function StepSuccess() {
  const { formData } = useSignup();

  // Animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Icône de succès animée */}
      <Animated.View
        style={[
          styles.successIconContainer,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.successIcon}>
          <IconSymbol name="checkmark" size={48} color={colors.textOnPrimary} />
        </View>
      </Animated.View>

      {/* Contenu */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.title}>Bienvenue, {formData.firstName} !</Text>
        <Text style={styles.subtitle}>
          Votre compte a été créé avec succès
        </Text>

        {/* Carte de profil mini */}
        <View style={styles.profilePreview}>
          {formData.profileImage ? (
            <Image
              source={{ uri: formData.profileImage }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <IconSymbol name="person.fill" size={28} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {formData.firstName} {formData.lastName}
            </Text>
            <Text style={styles.profileCity}>{formData.city}</Text>
          </View>
        </View>

        {/* Ce qui vous attend */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Ce qui vous attend</Text>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <IconSymbol name="calendar.badge.plus" size={20} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureLabel}>Découvrez des activités</Text>
              <Text style={styles.featureDescription}>
                Explorez les événements près de chez vous
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <IconSymbol name="person.2.fill" size={20} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureLabel}>Rencontrez des gens</Text>
              <Text style={styles.featureDescription}>
                Connectez-vous avec des personnes partageant vos intérêts
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <IconSymbol name="sparkles" size={20} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureLabel}>Vivez des expériences</Text>
              <Text style={styles.featureDescription}>
                Participez à des moments uniques et mémorables
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxxl,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: spacing.xxl,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
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
    marginBottom: spacing.xxl,
  },
  profilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    marginBottom: spacing.xxl,
    gap: spacing.lg,
    ...shadows.sm,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profilePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: 2,
  },
  profileCity: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
  },
  featuresCard: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  featuresTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
