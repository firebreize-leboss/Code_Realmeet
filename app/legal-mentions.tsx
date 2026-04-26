// app/legal-mentions.tsx
// Écran Mentions légales (obligatoire LCEN)

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {isLink ? (
        <TouchableOpacity onPress={() => Linking.openURL(value.startsWith('http') ? value : `mailto:${value}`)}>
          <Text style={styles.infoValueLink}>{value}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.infoValue}>{value}</Text>
      )}
    </View>
  );
}

export default function LegalMentionsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mentions l{'\u00e9'}gales</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tete */}
        <View style={styles.legalHeader}>
          <Text style={styles.legalTitle}>MENTIONS L{'\u00c9'}GALES</Text>
          <Text style={styles.legalSubtitle}>REALMEET</Text>
          <Text style={styles.legalInfoDate}>Conform{'\u00e9'}ment {'\u00e0'} la loi n{'\u00b0'} 2004-575 du 21 juin 2004 (LCEN)</Text>
        </View>

        {/* 1. Editeur */}
        <Section title="1. {'\u00c9'}diteur de l'application">
          <View style={styles.infoCard}>
            <InfoRow label="Nom" value="Alexandre PEMBE" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Statut" value="Entrepreneur individuel (micro-entreprise)" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Nom commercial" value="REALMEET" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Si{'\u00e8'}ge social" value="Paris, France" />
            <View style={styles.infoSeparator} />
            <InfoRow label="E-mail" value="contact@realmeet.fr" isLink />
            <View style={styles.infoSeparator} />
            <InfoRow label="Directeur de la publication" value="Alexandre PEMBE" />
          </View>
        </Section>

        {/* 2. Hebergeurs */}
        <Section title="2. H{'\u00e9'}bergeurs">
          <Text style={styles.subsectionTitle}>Infrastructure principale (base de donn{'\u00e9'}es, authentification, stockage)</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Prestataire" value="Supabase, Inc." />
            <View style={styles.infoSeparator} />
            <InfoRow label="Adresse" value="970 Toa Payoh North, #07-04, Singapore 318992" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Site web" value="https://supabase.com" isLink />
          </View>

          <Text style={[styles.subsectionTitle, { marginTop: spacing.lg }]}>Serveur de check-in</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Prestataire" value="OVH SAS" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Adresse" value="2 rue Kellermann, 59100 Roubaix, France" />
            <View style={styles.infoSeparator} />
            <InfoRow label="T{'\u00e9'}l{'\u00e9'}phone" value="1007" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Site web" value="https://www.ovhcloud.com" isLink />
          </View>

          <Text style={[styles.subsectionTitle, { marginTop: spacing.lg }]}>Notifications push</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Prestataire" value="Expo (650 Industries, Inc.)" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Site web" value="https://expo.dev" isLink />
          </View>
        </Section>

        {/* 3. Propriete intellectuelle */}
        <Section title="3. Propri{'\u00e9'}t{'\u00e9'} intellectuelle">
          <Text style={styles.bodyText}>
            L'ensemble du contenu de l'Application REALMEET (textes, graphiques, images, logo, ic{'\u00f4'}nes, code source) est prot{'\u00e9'}g{'\u00e9'} par le droit d'auteur et le droit de la propri{'\u00e9'}t{'\u00e9'} intellectuelle.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Toute reproduction, repr{'\u00e9'}sentation, modification ou exploitation non autoris{'\u00e9'}e est interdite et constitue une contrefa{'\u00e7'}on sanctionn{'\u00e9'}e par les articles L.335-2 et suivants du Code de la propri{'\u00e9'}t{'\u00e9'} intellectuelle.
          </Text>
        </Section>

        {/* 4. Donnees personnelles */}
        <Section title="4. Donn{'\u00e9'}es personnelles et CNIL">
          <Text style={styles.bodyText}>
            Conform{'\u00e9'}ment au R{'\u00e8'}glement G{'\u00e9'}n{'\u00e9'}ral sur la Protection des Donn{'\u00e9'}es (RGPD) et {'\u00e0'} la loi Informatique et Libert{'\u00e9'}s, vous disposez de droits sur vos donn{'\u00e9'}es personnelles.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Pour en savoir plus, consultez notre Politique de confidentialit{'\u00e9'}.
          </Text>
          <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
            <Text style={styles.inlineLink}>Consulter la Politique de confidentialit{'\u00e9'}</Text>
          </TouchableOpacity>
          <Text style={[styles.bodyText, { marginTop: 12 }]}>
            Vous pouvez {'\u00e9'}galement adresser une r{'\u00e9'}clamation {'\u00e0'} la CNIL :
          </Text>
          <View style={[styles.infoCard, { marginTop: spacing.sm }]}>
            <InfoRow label="Organisme" value="CNIL" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Adresse" value="3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07" />
            <View style={styles.infoSeparator} />
            <InfoRow label="Site web" value="https://www.cnil.fr" isLink />
          </View>
        </Section>

        {/* 5. Droit applicable */}
        <Section title="5. Droit applicable">
          <Text style={styles.bodyText}>
            Les pr{'\u00e9'}sentes mentions l{'\u00e9'}gales sont soumises au droit fran{'\u00e7'}ais. En cas de litige, les tribunaux fran{'\u00e7'}ais seront seuls comp{'\u00e9'}tents, sous r{'\u00e9'}serve des r{'\u00e8'}gles applicables aux consommateurs.
          </Text>
        </Section>

        <View style={{ height: 40 }} />
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
  legalHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  legalTitle: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  legalSubtitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  legalInfoDate: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subsectionTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  bodyText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 21,
  },
  infoCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-start',
  },
  infoLabel: {
    width: 110,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    lineHeight: 20,
  },
  infoValue: {
    flex: 1,
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoValueLink: {
    flex: 1,
    fontSize: typography.xs,
    fontFamily: 'Manrope_500Medium',
    color: colors.primary,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  infoSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.lg,
  },
  inlineLink: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
    fontFamily: 'Manrope_500Medium',
    marginTop: spacing.sm,
    textDecorationLine: 'underline',
  },
});
