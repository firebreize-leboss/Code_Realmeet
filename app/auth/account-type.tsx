// app/auth/account-type.tsx
// Page de sélection du type de compte - Design premium unifié

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function AccountTypeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={styles.header}
          >
            <Text style={styles.title}>Bienvenue sur RealMeet</Text>
            <Text style={styles.subtitle}>
              Choisissez votre type de compte pour continuer
            </Text>
          </Animated.View>

          {/* Card Particulier */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                  <IconSymbol name="person.fill" size={28} color={colors.primary} />
                </View>
                <View style={styles.cardTitleSection}>
                  <Text style={styles.cardTitle}>Particulier</Text>
                  <Text style={styles.cardDescription}>
                    Rejoignez des activités et rencontrez de nouvelles personnes
                  </Text>
                </View>
              </View>

              <View style={styles.separator} />

              <View style={styles.cardFeatures}>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>Rejoindre des activités</Text>
                </View>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>Créer vos événements</Text>
                </View>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>Messagerie intégrée</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.continueText}>Continuer</Text>
                <IconSymbol name="chevron.right" size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Card Entreprise */}
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push('/auth/login-business')}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, styles.iconContainerBusiness]}>
                  <IconSymbol name="building.2.fill" size={28} color={colors.textSecondary} />
                </View>
                <View style={styles.cardTitleSection}>
                  <Text style={styles.cardTitle}>Entreprise</Text>
                  <Text style={styles.cardDescription}>
                    Développez votre activité avec des événements professionnels
                  </Text>
                </View>
              </View>

              <View style={styles.separator} />

              <View style={styles.cardFeatures}>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark" size={16} color={colors.textTertiary} />
                  <Text style={styles.featureText}>Créer des événements pro</Text>
                </View>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark" size={16} color={colors.textTertiary} />
                  <Text style={styles.featureText}>Analytics avancés</Text>
                </View>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark" size={16} color={colors.textTertiary} />
                  <Text style={styles.featureText}>Gestion des participants</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.continueTextSecondary}>Continuer</Text>
                <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxxl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
  },
  header: {
    marginBottom: spacing.xxxl,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
  },
  iconContainerBusiness: {
    backgroundColor: colors.inputBackground,
  },
  cardTitleSection: {
    flex: 1,
    paddingTop: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    lineHeight: 20,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.lg,
  },
  cardFeatures: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  continueText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  continueTextSecondary: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
  },
});
