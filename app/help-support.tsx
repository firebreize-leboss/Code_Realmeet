// app/help-support.tsx
// Écran Aide & Support

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

function SupportCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.supportCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.supportCardIcon}>
        <IconSymbol name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.supportCardContent}>
        <Text style={styles.supportCardTitle}>{title}</Text>
        <Text style={styles.supportCardDescription}>{description}</Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <IconSymbol
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={14}
          color={colors.textTertiary}
        />
      </View>
      {expanded && <Text style={styles.faqAnswer}>{answer}</Text>}
    </TouchableOpacity>
  );
}

export default function HelpSupportScreen() {
  const router = useRouter();

  const handleEmail = () => {
    Linking.openURL('mailto:contact@realmeet.fr');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aide & Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <Text style={styles.intro}>
          Une question, un problème ou une suggestion ?{'\n'}
          Notre équipe est là pour t'aider.
        </Text>

        {/* Contact */}
        <Text style={styles.sectionLabel}>NOUS CONTACTER</Text>
        <View style={styles.sectionCard}>
          <SupportCard
            icon="envelope.fill"
            title="Envoyer un e-mail"
            description="contact@realmeet.fr"
            onPress={handleEmail}
          />
        </View>

        {/* FAQ */}
        <Text style={styles.sectionLabel}>QUESTIONS FRÉQUENTES</Text>
        <View style={styles.sectionCard}>
          <FAQItem
            question="Comment créer un compte ?"
            answer="Télécharge l'application REALMEET, appuie sur « Créer un compte » et suis les étapes. Tu auras besoin d'une adresse e-mail valide et d'être âgé(e) d'au moins 18 ans."
          />
          <View style={styles.separator} />
          <FAQItem
            question="Comment réserver une activité ?"
            answer="Parcours les activités disponibles depuis l'onglet Explorer, sélectionne celle qui t'intéresse, choisis un créneau et confirme ta réservation. Le paiement s'effectue directement dans l'application."
          />
          <View style={styles.separator} />
          <FAQItem
            question="Comment annuler une réservation ?"
            answer="Rends-toi dans l'onglet Mes Activités, sélectionne la réservation concernée et appuie sur « Annuler ». Les conditions d'annulation et de remboursement dépendent de l'activité et sont précisées dans les Conditions Générales de Vente."
          />
          <View style={styles.separator} />
          <FAQItem
            question="Comment signaler un problème ou un utilisateur ?"
            answer="Tu peux signaler un contenu ou un utilisateur directement depuis l'application en appuyant sur le menu (…) puis « Signaler ». Tu peux également nous contacter par e-mail à contact@realmeet.fr."
          />
          <View style={styles.separator} />
          <FAQItem
            question="Comment modifier mon profil ?"
            answer="Accède à ton profil, appuie sur « Modifier le profil » et mets à jour les informations souhaitées (photo, bio, centres d'intérêt, etc.)."
          />
          <View style={styles.separator} />
          <FAQItem
            question="Comment supprimer mon compte ?"
            answer="Tu peux supprimer ton compte depuis Paramètres > Supprimer mon compte. Cette action est irréversible. Tu peux aussi nous écrire à contact@realmeet.fr."
          />
        </View>

        {/* Liens utiles */}
        <Text style={styles.sectionLabel}>LIENS UTILES</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => router.push('/terms-of-use')}
            activeOpacity={0.7}
          >
            <IconSymbol name="doc.text.fill" size={18} color={colors.textSecondary} />
            <Text style={styles.linkText}>Conditions d'utilisation</Text>
            <IconSymbol name="chevron.right" size={14} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => router.push('/privacy-policy')}
            activeOpacity={0.7}
          >
            <IconSymbol name="shield.fill" size={18} color={colors.textSecondary} />
            <Text style={styles.linkText}>Politique de confidentialité</Text>
            <IconSymbol name="chevron.right" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Temps de réponse habituel : 24 à 48h
          </Text>
          <Text style={styles.footerVersion}>REALMEET v1.0.0</Text>
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
  intro: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xxl,
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
  sectionCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  supportCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportCardContent: {
    flex: 1,
  },
  supportCardTitle: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    marginBottom: 2,
  },
  supportCardDescription: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  faqItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  faqQuestion: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    flex: 1,
  },
  faqAnswer: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.lg,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  linkText: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  footerVersion: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textMuted,
  },
});
