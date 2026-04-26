// app/about.tsx
// Écran À propos de REALMEET

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';

function LinkCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.linkCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.linkCardIcon}>
        <IconSymbol name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.linkCardContent}>
        <Text style={styles.linkCardTitle}>{title}</Text>
        <Text style={styles.linkCardSubtitle}>{subtitle}</Text>
      </View>
      <IconSymbol name="chevron.right" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'\u00c0'} propos</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Nom */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <Text style={styles.appName}>REALMEET</Text>
          <Text style={styles.tagline}>Rencontres sociales par activit{'\u00e9'}s</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>
            REALMEET est une application mobile qui facilite les rencontres sociales {'\u00e0'} travers des activit{'\u00e9'}s en groupe.
          </Text>
          <Text style={[styles.descriptionText, { marginTop: 10 }]}>
            Inscris-toi {'\u00e0'} des activit{'\u00e9'}s pr{'\u00e8'}s de chez toi, rejoins un groupe form{'\u00e9'} par affinit{'\u00e9'}s et retrouve-toi en vrai pour passer un bon moment.
          </Text>
          <Text style={[styles.descriptionText, { marginTop: 10 }]}>
            Pas de swipe, pas de profils {'\u00e0'} scroller. Juste des activit{'\u00e9'}s, des groupes et des rencontres IRL.
          </Text>
        </View>

        {/* Comment ca marche */}
        <Text style={styles.sectionLabel}>COMMENT {'\u00c7'}A MARCHE</Text>
        <View style={styles.stepsCard}>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Choisis une activit{'\u00e9'}</Text>
              <Text style={styles.stepDescription}>Explore les activit{'\u00e9'}s propos{'\u00e9'}es par des entreprises partenaires pr{'\u00e8'}s de chez toi.</Text>
            </View>
          </View>
          <View style={styles.stepSeparator} />
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Rejoins un groupe</Text>
              <Text style={styles.stepDescription}>Tu es automatiquement plac{'\u00e9'}(e) dans un groupe form{'\u00e9'} par affinit{'\u00e9'}s, 24h avant l'activit{'\u00e9'}.</Text>
            </View>
          </View>
          <View style={styles.stepSeparator} />
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Retrouve-toi IRL</Text>
              <Text style={styles.stepDescription}>Pr{'\u00e9'}sente ton QR code sur place, rencontre ton groupe et profite de l'activit{'\u00e9'} !</Text>
            </View>
          </View>
        </View>

        {/* Liens */}
        <Text style={styles.sectionLabel}>LIENS</Text>
        <View style={styles.linksCard}>
          <LinkCard
            icon="envelope.fill"
            title="Nous contacter"
            subtitle="contact@realmeet.fr"
            onPress={() => Linking.openURL('mailto:contact@realmeet.fr')}
          />
          <View style={styles.separator} />
          <LinkCard
            icon="doc.text.fill"
            title="Conditions d'utilisation"
            subtitle="CGU de REALMEET"
            onPress={() => router.push('/terms-of-use')}
          />
          <View style={styles.separator} />
          <LinkCard
            icon="shield.fill"
            title="Politique de confidentialit{'\u00e9'}"
            subtitle="Protection de vos donn{'\u00e9'}es"
            onPress={() => router.push('/privacy-policy')}
          />
          <View style={styles.separator} />
          <LinkCard
            icon="building.columns.fill"
            title="Mentions l{'\u00e9'}gales"
            subtitle="{'\u00c9'}diteur, h{'\u00e9'}bergeur, CNIL"
            onPress={() => router.push('/legal-mentions')}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Fait avec passion {'\u00e0'} Paris</Text>
          <Text style={styles.footerCopyright}>{'\u00a9'} 2026 REALMEET — Tous droits r{'\u00e9'}serv{'\u00e9'}s</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 50,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    fontSize: 32,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
  appName: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  version: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  descriptionCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  descriptionText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 21,
  },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    letterSpacing: 0.8,
  },
  stepsCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  stepSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
    marginLeft: 60,
  },
  linksCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  linkCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkCardContent: {
    flex: 1,
  },
  linkCardTitle: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    marginBottom: 1,
  },
  linkCardSubtitle: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
    marginLeft: 68,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  footerCopyright: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textMuted,
  },
});
