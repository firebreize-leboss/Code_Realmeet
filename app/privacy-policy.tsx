// app/privacy-policy.tsx
// Politique de confidentialité — Conforme RGPD

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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      <Text style={styles.subSectionTitle}>{title}</Text>
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
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Politique de confidentialit{'\u00e9'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tete */}
        <View style={styles.legalHeader}>
          <Text style={styles.legalTitle}>POLITIQUE DE CONFIDENTIALIT{'\u00c9'}</Text>
          <Text style={styles.legalSubtitle}>REALMEET</Text>
          <View style={styles.legalInfoCard}>
            <Text style={styles.legalInfoText}>
              Responsable du traitement : Alexandre PEMBE
            </Text>
            <Text style={styles.legalInfoText}>Statut : Entrepreneur individuel (micro-entreprise)</Text>
            <Text style={styles.legalInfoText}>Nom commercial : REALMEET</Text>
            <Text style={styles.legalInfoText}>Si{'\u00e8'}ge : Paris, France</Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@realmeet.fr')}>
              <Text style={styles.emailLink}>Contact : contact@realmeet.fr</Text>
            </TouchableOpacity>
            <Text style={styles.legalInfoDate}>Derni{'\u00e8'}re mise {'\u00e0'} jour : 08/04/2026</Text>
          </View>
        </View>

        {/* 1. Introduction */}
        <Section title="1. Introduction">
          <Text style={styles.bodyText}>
            La pr{'\u00e9'}sente Politique de confidentialit{'\u00e9'} d{'\u00e9'}crit comment REALMEET collecte, utilise, stocke et prot{'\u00e8'}ge les donn{'\u00e9'}es personnelles des Utilisateurs de l'application mobile REALMEET (l'{'\u00ab'} Application {'\u00bb'}).
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            REALMEET s'engage {'\u00e0'} respecter le R{'\u00e8'}glement G{'\u00e9'}n{'\u00e9'}ral sur la Protection des Donn{'\u00e9'}es (RGPD - R{'\u00e8'}glement UE 2016/679) et la loi Informatique et Libert{'\u00e9'}s du 6 janvier 1978 modifi{'\u00e9'}e.
          </Text>
        </Section>

        {/* 2. Responsable du traitement */}
        <Section title="2. Responsable du traitement">
          <Text style={styles.bodyText}>
            Le responsable du traitement des donn{'\u00e9'}es personnelles est :
          </Text>
          <Bullet text="Alexandre PEMBE" />
          <Bullet text="Entrepreneur individuel (micro-entreprise)" />
          <Bullet text="Nom commercial : REALMEET" />
          <Bullet text="Adresse : Paris, France" />
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Pour toute question relative {'\u00e0'} la protection de vos donn{'\u00e9'}es :
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@realmeet.fr')}>
            <Text style={styles.emailLink}>contact@realmeet.fr</Text>
          </TouchableOpacity>
        </Section>

        {/* 3. Donnees collectees */}
        <Section title="3. Donn{'\u00e9'}es collect{'\u00e9'}es">
          <SubSection title="3.1 Donn{'\u00e9'}es fournies par l'Utilisateur">
            <Bullet text="Identit{'\u00e9'} : nom, pr{'\u00e9'}nom, adresse e-mail" />
            <Bullet text="Date de naissance (v{'\u00e9'}rification de majorit{'\u00e9'} 18+)" />
            <Bullet text="Num{'\u00e9'}ro de t{'\u00e9'}l{'\u00e9'}phone (v{'\u00e9'}rification du compte, syst{'\u00e8'}me anti-abus)" />
            <Bullet text="Photo de profil" />
            <Bullet text="Biographie, centres d'int{'\u00e9'}r{'\u00ea'}t, ville" />
            <Bullet text="Messages envoy{'\u00e9'}s via la messagerie" />
          </SubSection>
          <SubSection title="3.2 Donn{'\u00e9'}es collect{'\u00e9'}es automatiquement">
            <Bullet text="Donn{'\u00e9'}es de g{'\u00e9'}olocalisation (si autoris{'\u00e9'}e, pour afficher les activit{'\u00e9'}s proches)" />
            <Bullet text="Donn{'\u00e9'}es techniques : adresse IP, type d'appareil, syst{'\u00e8'}me d'exploitation, identifiant de l'appareil" />
            <Bullet text="Logs de connexion et d'utilisation" />
            <Bullet text="Donn{'\u00e9'}es de pr{'\u00e9'}sence : check-in QR code, horodatage de pr{'\u00e9'}sence" />
            <Bullet text="Token de notifications push (Expo Push Notifications)" />
          </SubSection>
          <SubSection title="3.3 Donn{'\u00e9'}es li{'\u00e9'}es {'\u00e0'} l'utilisation du service">
            <Bullet text="Inscriptions aux activit{'\u00e9'}s et cr{'\u00e9'}neaux" />
            <Bullet text="Historique de participation, absences (no-show), p{'\u00e9'}nalit{'\u00e9'}s" />
            <Bullet text="Demandes d'amiti{'\u00e9'}, contacts, blocages" />
            <Bullet text="Invitations +1 envoy{'\u00e9'}es et re{'\u00e7'}ues" />
          </SubSection>
        </Section>

        {/* 4. Finalites et bases legales */}
        <Section title="4. Finalit{'\u00e9'}s et bases l{'\u00e9'}gales">
          <View style={styles.tableCard}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableHeader]}>Finalit{'\u00e9'}</Text>
              <Text style={[styles.tableCell, styles.tableHeader]}>Base l{'\u00e9'}gale</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Cr{'\u00e9'}ation et gestion du compte</Text>
              <Text style={styles.tableCell}>Ex{'\u00e9'}cution du contrat</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Inscription aux activit{'\u00e9'}s</Text>
              <Text style={styles.tableCell}>Ex{'\u00e9'}cution du contrat</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Formation de groupes par affinit{'\u00e9'}</Text>
              <Text style={styles.tableCell}>Ex{'\u00e9'}cution du contrat</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Messagerie et conversations</Text>
              <Text style={styles.tableCell}>Ex{'\u00e9'}cution du contrat</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>V{'\u00e9'}rification de pr{'\u00e9'}sence (QR)</Text>
              <Text style={styles.tableCell}>Int{'\u00e9'}r{'\u00ea'}t l{'\u00e9'}gitime</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Gestion des p{'\u00e9'}nalit{'\u00e9'}s / bannissement</Text>
              <Text style={styles.tableCell}>Int{'\u00e9'}r{'\u00ea'}t l{'\u00e9'}gitime</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>G{'\u00e9'}olocalisation</Text>
              <Text style={styles.tableCell}>Consentement</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Notifications push</Text>
              <Text style={styles.tableCell}>Consentement</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Traceurs analytics / marketing</Text>
              <Text style={styles.tableCell}>Consentement</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Mod{'\u00e9'}ration et s{'\u00e9'}curit{'\u00e9'}</Text>
              <Text style={styles.tableCell}>Int{'\u00e9'}r{'\u00ea'}t l{'\u00e9'}gitime</Text>
            </View>
          </View>
        </Section>

        {/* 5. Durees de conservation */}
        <Section title="5. Dur{'\u00e9'}es de conservation">
          <Bullet text="Donn{'\u00e9'}es du compte : conserv{'\u00e9'}es pendant la dur{'\u00e9'}e d'utilisation du service, puis 3 ans apr{'\u00e8'}s la suppression du compte" />
          <Bullet text="Messages et conversations de groupe : supprim{'\u00e9'}s automatiquement {'\u00e0'} la fin de l'activit{'\u00e9'}" />
          <Bullet text="Conversations priv{'\u00e9'}es (amis) : conserv{'\u00e9'}es tant que la relation d'amiti{'\u00e9'} est active" />
          <Bullet text="Logs de connexion : 1 an (obligation l{'\u00e9'}gale)" />
          <Bullet text="Donn{'\u00e9'}es de check-in et p{'\u00e9'}nalit{'\u00e9'}s : 3 ans" />
          <Bullet text="Donn{'\u00e9'}es de bannissement (num{'\u00e9'}ro de t{'\u00e9'}l{'\u00e9'}phone hash{'\u00e9'}) : dur{'\u00e9'}e ind{'\u00e9'}termin{'\u00e9'}e (s{'\u00e9'}curit{'\u00e9'} du service)" />
          <Bullet text="Donn{'\u00e9'}es de g{'\u00e9'}olocalisation : non stock{'\u00e9'}es (utilis{'\u00e9'}es uniquement en temps r{'\u00e9'}el)" />
        </Section>

        {/* 6. Sous-traitants et destinataires */}
        <Section title="6. Sous-traitants et destinataires">
          <Text style={styles.bodyText}>
            Vos donn{'\u00e9'}es peuvent {'\u00ea'}tre trait{'\u00e9'}es par les sous-traitants suivants :
          </Text>
          <View style={styles.tableCard}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableHeader]}>Prestataire</Text>
              <Text style={[styles.tableCell, styles.tableHeader]}>Finalit{'\u00e9'}</Text>
              <Text style={[styles.tableCell, styles.tableHeader]}>Localisation</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Supabase</Text>
              <Text style={styles.tableCell}>H{'\u00e9'}bergement BDD, auth, stockage</Text>
              <Text style={styles.tableCell}>UE / USA</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>OVH</Text>
              <Text style={styles.tableCell}>Serveur check-in</Text>
              <Text style={styles.tableCell}>France</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Expo (EAS)</Text>
              <Text style={styles.tableCell}>Notifications push</Text>
              <Text style={styles.tableCell}>USA</Text>
            </View>
            <View style={styles.tableSeparator} />
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Protomaps</Text>
              <Text style={styles.tableCell}>Affichage cartographique</Text>
              <Text style={styles.tableCell}>USA</Text>
            </View>
          </View>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Vos donn{'\u00e9'}es ne sont jamais vendues {'\u00e0'} des tiers.
          </Text>
        </Section>

        {/* 7. Transferts hors UE */}
        <Section title="7. Transferts hors Union europ{'\u00e9'}enne">
          <Text style={styles.bodyText}>
            Certains sous-traitants sont situ{'\u00e9'}s aux {'\u00c9'}tats-Unis. Ces transferts sont encadr{'\u00e9'}s par :
          </Text>
          <Bullet text="Le EU-US Data Privacy Framework (DPF) lorsque le prestataire est certifi{'\u00e9'}" />
          <Bullet text="Des clauses contractuelles types (CCT) approuv{'\u00e9'}es par la Commission europ{'\u00e9'}enne" />
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Vous pouvez obtenir une copie des garanties appliqu{'\u00e9'}es en {'\u00e9'}crivant {'\u00e0'} contact@realmeet.fr.
          </Text>
        </Section>

        {/* 8. Traceurs et cookies */}
        <Section title="8. Traceurs et cookies">
          <Text style={styles.bodyText}>
            L'Application peut utiliser des traceurs (SDK analytics, SDK publicitaires) soumis {'\u00e0'} votre consentement pr{'\u00e9'}alable, {'\u00e0'} l'exception des traceurs strictement n{'\u00e9'}cessaires au fonctionnement du service.
          </Text>
          <SubSection title="Cat{'\u00e9'}gories de traceurs">
            <Bullet text="N{'\u00e9'}cessaires (toujours actifs) : authentification, s{'\u00e9'}curit{'\u00e9'}" />
            <Bullet text="Analytics : mesure d'audience et am{'\u00e9'}lioration du service" />
            <Bullet text="Marketing : publicit{'\u00e9'} cibl{'\u00e9'}e (Meta Ads, TikTok Ads, etc.)" />
          </SubSection>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Vous pouvez modifier ou retirer votre consentement {'\u00e0'} tout moment dans Param{'\u00e8'}tres {'>'} Confidentialit{'\u00e9'}.
          </Text>
        </Section>

        {/* 9. Securite */}
        <Section title="9. S{'\u00e9'}curit{'\u00e9'} des donn{'\u00e9'}es">
          <Text style={styles.bodyText}>
            REALMEET met en {'\u0153'}uvre des mesures techniques et organisationnelles pour prot{'\u00e9'}ger vos donn{'\u00e9'}es :
          </Text>
          <Bullet text="Chiffrement des donn{'\u00e9'}es en transit (HTTPS/TLS)" />
          <Bullet text="Chiffrement des donn{'\u00e9'}es au repos (base de donn{'\u00e9'}es)" />
          <Bullet text="Authentification s{'\u00e9'}curis{'\u00e9'}e (JWT, tokens {'\u00e0'} dur{'\u00e9'}e limit{'\u00e9'}e)" />
          <Bullet text="Contr{'\u00f4'}le d'acc{'\u00e8'}s par Row Level Security (RLS)" />
          <Bullet text="Protection anti-abus (rate limiting, nonce anti-replay)" />
        </Section>

        {/* 10. Vos droits */}
        <Section title="10. Vos droits">
          <Text style={styles.bodyText}>
            Conform{'\u00e9'}ment au RGPD et {'\u00e0'} la loi Informatique et Libert{'\u00e9'}s, vous disposez des droits suivants :
          </Text>
          <Bullet text="Droit d'acc{'\u00e8'}s : obtenir une copie de vos donn{'\u00e9'}es personnelles" />
          <Bullet text="Droit de rectification : corriger des donn{'\u00e9'}es inexactes" />
          <Bullet text="Droit {'\u00e0'} l'effacement (droit {'\u00e0'} l'oubli) : demander la suppression de vos donn{'\u00e9'}es" />
          <Bullet text="Droit {'\u00e0'} la limitation du traitement : restreindre temporairement l'utilisation de vos donn{'\u00e9'}es" />
          <Bullet text="Droit d'opposition : vous opposer au traitement fond{'\u00e9'} sur l'int{'\u00e9'}r{'\u00ea'}t l{'\u00e9'}gitime" />
          <Bullet text="Droit {'\u00e0'} la portabilit{'\u00e9'} : recevoir vos donn{'\u00e9'}es dans un format structur{'\u00e9'}" />
          <Bullet text="Droit de retrait du consentement : retirer {'\u00e0'} tout moment votre consentement (g{'\u00e9'}olocalisation, notifications, traceurs)" />
          <Text style={[styles.bodyText, { marginTop: 12 }]}>
            Pour exercer vos droits, {'\u00e9'}crivez {'\u00e0'} :
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@realmeet.fr')}>
            <Text style={styles.emailLink}>contact@realmeet.fr</Text>
          </TouchableOpacity>
          <Text style={[styles.bodyText, { marginTop: 12 }]}>
            Vous pouvez {'\u00e9'}galement supprimer votre compte directement depuis l'application (Param{'\u00e8'}tres {'>'} Supprimer mon compte).
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            R{'\u00e9'}ponse sous 30 jours maximum. Une pi{'\u00e8'}ce d'identit{'\u00e9'} peut {'\u00ea'}tre demand{'\u00e9'}e en cas de doute sur votre identit{'\u00e9'}.
          </Text>
        </Section>

        {/* 11. Reclamation CNIL */}
        <Section title="11. R{'\u00e9'}clamation">
          <Text style={styles.bodyText}>
            Si vous estimez que le traitement de vos donn{'\u00e9'}es ne respecte pas la r{'\u00e9'}glementation, vous pouvez introduire une r{'\u00e9'}clamation aupr{'\u00e8'}s de la CNIL :
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Commission Nationale de l'Informatique et des Libert{'\u00e9'}s (CNIL){'\n'}
            3 Place de Fontenoy, TSA 80715{'\n'}
            75334 Paris Cedex 07
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.cnil.fr')}>
            <Text style={styles.emailLink}>www.cnil.fr</Text>
          </TouchableOpacity>
        </Section>

        {/* 12. Modifications */}
        <Section title="12. Modifications de la politique">
          <Text style={styles.bodyText}>
            REALMEET peut modifier la pr{'\u00e9'}sente politique pour tenir compte d'{'\u00e9'}volutions l{'\u00e9'}gales ou techniques. Vous serez inform{'\u00e9'}(e) de toute modification substantielle via l'Application. L'utilisation continue apr{'\u00e8'}s notification vaut acceptation.
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
    marginBottom: spacing.lg,
  },
  legalInfoCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    width: '100%',
    gap: 4,
  },
  legalInfoText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  legalInfoDate: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginTop: spacing.sm,
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
  subSection: {
    marginTop: spacing.md,
  },
  subSectionTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bodyText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
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
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginRight: 8,
    lineHeight: 21,
  },
  emailLink: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  tableCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tableCell: {
    flex: 1,
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  tableHeader: {
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  tableSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
});
