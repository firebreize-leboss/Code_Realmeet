// app/privacy-policy.tsx
// Écran Politique de confidentialité

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

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bodyText}>{text}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Politique de confidentialité</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          REALMEET protège ta vie privée et n'utilise tes données que pour faire fonctionner le service.
        </Text>

        <Section title="Données collectées">
          <Bullet text="Identité : nom, prénom, e-mail, date de naissance (vérification 18+)" />
          <Bullet text="Réservations : activité, date/heure, confirmations" />
          <Bullet text="Données techniques : adresse IP, logs de connexion" />
          <Bullet text="Fonctionnalités sociales : contenu des messages/avis, métadonnées (date/heure, destinataires)" />
        </Section>

        <Section title="Paiements">
          <Text style={styles.bodyText}>
            Les paiements sont traités par un prestataire sécurisé (ex. Stripe). REALMEET ne stocke jamais tes données de carte bancaire.
          </Text>
        </Section>

        <Section title="Publicité et traceurs">
          <Text style={styles.bodyText}>
            Pour la publicité et la mesure d'audience (Meta Ads, TikTok Ads, etc.), nous utilisons des traceurs/SDK uniquement après ton consentement.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Tu choisis de façon granulaire les catégories autorisées :
          </Text>
          <Bullet text="Nécessaires (toujours actifs)" />
          <Bullet text="Analytics" />
          <Bullet text="Marketing" />
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Tu peux modifier ou retirer ton consentement à tout moment dans Réglages {'>'} Confidentialité.
          </Text>
        </Section>

        <Section title="Transferts hors UE">
          <Text style={styles.bodyText}>
            Certains partenaires peuvent être situés hors UE (ex. États-Unis). Le cas échéant, nous utilisons des mécanismes de transfert reconnus (clauses contractuelles types).
          </Text>
        </Section>

        <Section title="Tes droits">
          <Bullet text="Accès à tes données" />
          <Bullet text="Rectification" />
          <Bullet text="Suppression" />
          <Bullet text="Opposition" />
          <Bullet text="Portabilité" />
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Tu peux demander la suppression de ton compte directement depuis l'application ou en écrivant à :
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:realmeet.france@gmail.com')}
          >
            <Text style={styles.emailLink}>realmeet.france@gmail.com</Text>
          </TouchableOpacity>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  intro: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  bodyText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
    lineHeight: 21,
  },
  emailLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});
