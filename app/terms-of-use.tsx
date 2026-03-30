// app/terms-of-use.tsx
// Écran Conditions Générales d'Utilisation (CGU)

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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      <Text style={styles.subSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function TermsOfUseScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conditions d'utilisation</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête légal */}
        <View style={styles.legalHeader}>
          <Text style={styles.legalTitle}>CONDITIONS GÉNÉRALES D'UTILISATION</Text>
          <Text style={styles.legalSubtitle}>REALMEET</Text>
          <View style={styles.legalInfoCard}>
            <Text style={styles.legalInfoText}>
              Éditeur : Alexandre PEMBE – Entrepreneur individuel (micro-entreprise)
            </Text>
            <Text style={styles.legalInfoText}>Nom commercial : REALMEET</Text>
            <Text style={styles.legalInfoText}>Siège : Paris, France</Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@realmeet.fr')}>
              <Text style={styles.emailLink}>Contact : contact@realmeet.fr</Text>
            </TouchableOpacity>
            <Text style={styles.legalInfoDate}>Dernière mise à jour : 02/03/2026</Text>
          </View>
        </View>

        {/* 1. Objet */}
        <Section title="1. Objet">
          <Text style={styles.bodyText}>
            Les présentes Conditions Générales d'Utilisation (les « CGU ») régissent l'accès et l'utilisation de l'application mobile REALMEET (l'« Application ») et de ses fonctionnalités.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            REALMEET est une plateforme technique de mise en relation permettant à des utilisateurs majeurs (18+) de réserver des activités sociales proposées et exécutées par des entreprises partenaires (bars, restaurants, loisirs, karting, paintball, etc.) (les « Entreprises Hôtes »). REALMEET n'organise pas matériellement les activités et n'est pas le prestataire des activités proposées.
          </Text>
        </Section>

        {/* 2. Définitions */}
        <Section title="2. Définitions">
          <Bullet text="« Utilisateur » : toute personne physique majeure (18+) utilisant l'Application." />
          <Bullet text="« Compte » : espace personnel associé à l'Utilisateur." />
          <Bullet text="« Entreprise Hôte » : entreprise partenaire proposant et réalisant une Activité." />
          <Bullet text="« Activité » : prestation proposée et réalisée par une Entreprise Hôte." />
          <Bullet text="« Réservation » : commande d'une Activité effectuée via l'Application." />
          <Bullet text="« Contenu » : tout contenu (message, avis, note, photo, texte, etc.) publié, transmis ou accessible via l'Application." />
          <Bullet text="« Services » : fonctionnalités de l'Application (mise en relation, réservation, messagerie, groupes, avis, etc.)." />
        </Section>

        {/* 3. Acceptation des CGU */}
        <Section title="3. Acceptation des CGU">
          <Text style={styles.bodyText}>
            L'accès à l'Application et/ou la création d'un Compte implique l'acceptation sans réserve des CGU. L'Utilisateur reconnaît en avoir pris connaissance.
          </Text>
        </Section>

        {/* 4. Accès réservé aux majeurs */}
        <Section title="4. Accès réservé aux majeurs (18+)">
          <Text style={styles.bodyText}>
            L'Application est strictement réservée aux personnes âgées d'au moins 18 ans. L'Utilisateur renseigne sa date de naissance à l'inscription et garantit l'exactitude des informations fournies.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            En cas de doute ou de fausse déclaration, REALMEET peut demander des vérifications et/ou suspendre ou supprimer le Compte.
          </Text>
        </Section>

        {/* 5. Compte – Profil – Sécurité */}
        <Section title="5. Compte – Profil – Sécurité">
          <SubSection title="5.1 Création du compte">
            <Text style={styles.bodyText}>
              Pour créer un Compte, l'Utilisateur fournit des informations exactes (nom, prénom, e-mail, date de naissance, etc.) et s'engage à les maintenir à jour.
            </Text>
          </SubSection>
          <SubSection title="5.2 Affichage du profil">
            <Text style={styles.bodyText}>
              Les profils affichent Prénom + initiale (ex. « Alexandre P. »). L'usurpation d'identité et les faux profils sont interdits.
            </Text>
          </SubSection>
          <SubSection title="5.3 Sécurité du compte">
            <Text style={styles.bodyText}>
              L'Utilisateur est responsable de la confidentialité de ses accès et de toute activité réalisée via son Compte. En cas de suspicion d'accès non autorisé, contactez REALMEET :
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@realmeet.fr')}>
              <Text style={styles.emailLink}>contact@realmeet.fr</Text>
            </TouchableOpacity>
          </SubSection>
        </Section>

        {/* 6. Description des Services */}
        <Section title="6. Description des Services">
          <Text style={styles.bodyText}>REALMEET permet notamment :</Text>
          <Bullet text="de consulter des Activités proposées par des Entreprises Hôtes ;" />
          <Bullet text="d'effectuer des Réservations et paiements en ligne ;" />
          <Bullet text="d'utiliser une messagerie privée, des discussions de groupe liées aux réservations, et des espaces d'échanges associés aux Activités ;" />
          <Bullet text="de publier des avis/notes après une Activité." />
          <View style={styles.importantBox}>
            <Text style={styles.importantText}>
              Le contrat de prestation relatif à l'Activité est conclu directement entre l'Utilisateur et l'Entreprise Hôte. REALMEET agit comme intermédiaire technique et n'est pas responsable de l'exécution matérielle de l'Activité.
            </Text>
          </View>
        </Section>

        {/* 7. Messagerie / Chat / Groupes */}
        <Section title="7. Messagerie / Chat / Groupes">
          <SubSection title="7.1 Finalité">
            <Text style={styles.bodyText}>
              Ces fonctionnalités ont pour finalité l'organisation pratique et les échanges sociaux entre Utilisateurs, notamment entre participants à une même Activité.
            </Text>
          </SubSection>
          <SubSection title="7.2 Ouverture des groupes">
            <Text style={styles.bodyText}>
              Les groupes de discussion liés à une Activité s'ouvrent automatiquement 24 heures avant l'heure de début de l'Activité.
            </Text>
          </SubSection>
          <SubSection title="7.3 Fermeture des groupes">
            <Text style={styles.bodyText}>
              Les groupes liés à une Activité sont fermés à la fin de l'Activité (heure de fin prévue), sous réserve d'une fermeture anticipée en cas d'incident, d'abus ou de modération, et/ou d'adaptations techniques communiquées dans l'Application.
            </Text>
          </SubSection>
          <SubSection title="7.4 Responsabilité des échanges">
            <Text style={styles.bodyText}>
              Chaque Utilisateur est responsable des Contenus qu'il publie ou transmet. REALMEET n'exerce pas de contrôle général a priori des Contenus, mais peut intervenir par modération conformément à l'article 10.
            </Text>
          </SubSection>
          <SubSection title="7.5 Vie privée – Partage de données">
            <Text style={styles.bodyText}>
              Il est interdit de diffuser des données personnelles de tiers (coordonnées, photos, informations privées) sans consentement, ainsi que tout Contenu portant atteinte à la vie privée.
            </Text>
          </SubSection>
        </Section>

        {/* 8. Avis et notes */}
        <Section title="8. Avis et notes">
          <SubSection title="8.1 Conditions de dépôt">
            <Text style={styles.bodyText}>
              REALMEET peut réserver le dépôt d'avis/notes aux Utilisateurs ayant effectivement réservé (et/ou participé) à l'Activité.
            </Text>
          </SubSection>
          <SubSection title="8.2 Règles">
            <Text style={styles.bodyText}>
              Les avis doivent être sincères, pertinents et conformes à la loi. Sont interdits : propos injurieux, diffamatoires, discriminatoires, haineux, mensongers, ou sans lien avec l'Activité.
            </Text>
          </SubSection>
          <SubSection title="8.3 Modération">
            <Text style={styles.bodyText}>
              REALMEET se réserve le droit de modérer, retirer ou déréférencer tout avis non conforme et de sanctionner les abus.
            </Text>
          </SubSection>
        </Section>

        {/* 9. Règles de conduite */}
        <Section title="9. Règles de conduite – Contenus interdits">
          <Text style={styles.bodyText}>Sont notamment interdits :</Text>
          <Bullet text="Harcèlement, menaces, intimidation" />
          <Bullet text="Incitation à la haine/violence, discriminations" />
          <Bullet text="Contenus sexuels explicites, exploitation, sollicitation" />
          <Bullet text="Doxxing, atteintes à la vie privée, diffusion de coordonnées sans consentement" />
          <Bullet text="Escroqueries, phishing, liens malveillants" />
          <Bullet text="Usurpation d'identité, faux profils" />
          <Bullet text="Contenus ou incitations à des activités illégales" />
        </Section>

        {/* 10. Signalement – Modération – Sanctions */}
        <Section title="10. Signalement – Modération – Sanctions">
          <SubSection title="10.1 Signalement">
            <Text style={styles.bodyText}>
              Tout Utilisateur peut signaler un Contenu ou un Compte via les fonctionnalités de signalement et/ou par e-mail :
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@realmeet.fr')}>
              <Text style={styles.emailLink}>contact@realmeet.fr</Text>
            </TouchableOpacity>
          </SubSection>
          <SubSection title="10.2 Mesures">
            <Text style={styles.bodyText}>
              REALMEET peut prendre toute mesure proportionnée, notamment :
            </Text>
            <Bullet text="Suppression/masquage/déréférencement de Contenu" />
            <Bullet text="Limitation de fonctionnalités (messagerie, groupes, avis, réservations)" />
            <Bullet text="Suspension temporaire" />
            <Bullet text="Bannissement définitif / suppression du Compte" />
          </SubSection>
          <SubSection title="10.3 Mesures d'urgence">
            <Text style={styles.bodyText}>
              En cas de risque pour la sécurité, REALMEET peut suspendre immédiatement un Compte à titre conservatoire, le temps des vérifications.
            </Text>
          </SubSection>
          <SubSection title="10.4 Conservation de preuves">
            <Text style={styles.bodyText}>
              REALMEET peut conserver des éléments (logs, métadonnées, contenus signalés) à des fins de sécurité, prévention des abus, gestion des litiges et conformité légale.
            </Text>
          </SubSection>
        </Section>

        {/* 11. Réservations */}
        <Section title="11. Réservations – Renvoi aux CGV">
          <Text style={styles.bodyText}>
            Les conditions de Réservation, paiement, annulation/remboursement et l'exclusion du droit de rétractation sont détaillées dans les CGV / Conditions de réservation, acceptées lors de chaque Réservation.
          </Text>
        </Section>

        {/* 12. Propriété intellectuelle */}
        <Section title="12. Propriété intellectuelle">
          <Text style={styles.bodyText}>
            L'Application, la marque REALMEET, le logo, les éléments graphiques, le code, la base de données et contenus éditoriaux sont protégés et demeurent la propriété de REALMEET et/ou de ses concédants.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            L'Utilisateur concède à REALMEET une licence non exclusive, mondiale et gratuite d'hébergement, reproduction et représentation de ses Contenus strictement nécessaire au fonctionnement du service (affichage aux destinataires, stockage technique, modération).
          </Text>
        </Section>

        {/* 13. Disponibilité */}
        <Section title="13. Disponibilité – Maintenance">
          <Text style={styles.bodyText}>
            REALMEET s'efforce d'assurer l'accès à l'Application, sans garantie d'absence d'interruption (maintenance, mises à jour, incidents, dépendances techniques). REALMEET peut suspendre temporairement l'accès pour raisons techniques ou de sécurité.
          </Text>
        </Section>

        {/* 14. Responsabilité */}
        <Section title="14. Responsabilité">
          <SubSection title="14.1 Plateforme non organisatrice">
            <Text style={styles.bodyText}>
              REALMEET n'est pas l'organisateur des Activités. L'Entreprise Hôte est seule responsable de l'exécution de l'Activité, de l'accueil, des règles de sécurité sur place et de la conformité de la prestation.
            </Text>
          </SubSection>
          <SubSection title="14.2 Limitation">
            <Text style={styles.bodyText}>
              Dans les limites autorisées par la loi, la responsabilité de REALMEET est limitée aux dommages directs et au montant effectivement payé par l'Utilisateur pour la Réservation concernée.
            </Text>
            <Text style={[styles.bodyText, { marginTop: 8 }]}>REALMEET n'est pas responsable :</Text>
            <Bullet text="du comportement des participants ;" />
            <Bullet text="des échanges via messagerie/groupes ;" />
            <Bullet text="de la mauvaise exécution de l'Activité par l'Entreprise Hôte ;" />
            <Bullet text="des dommages indirects (perte de chance, etc.), sous réserve des règles impératives applicables aux consommateurs." />
          </SubSection>
        </Section>

        {/* 15. Force majeure */}
        <Section title="15. Force majeure">
          <Text style={styles.bodyText}>
            Aucune Partie ne sera responsable d'un manquement dû à un événement de force majeure au sens de l'article 1218 du Code civil.
          </Text>
        </Section>

        {/* 16. Données personnelles */}
        <Section title="16. Données personnelles">
          <Text style={styles.bodyText}>
            Les traitements de données personnelles (dont messagerie, avis, logs, traceurs) sont décrits dans la Politique de confidentialité. L'Utilisateur peut retirer son consentement aux traceurs non nécessaires à tout moment.
          </Text>
          <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
            <Text style={styles.inlineLink}>Consulter la Politique de confidentialité</Text>
          </TouchableOpacity>
        </Section>

        {/* 17. Modification des CGU */}
        <Section title="17. Modification des CGU">
          <Text style={styles.bodyText}>
            REALMEET peut modifier les CGU pour tenir compte d'évolutions légales, techniques ou fonctionnelles. L'Utilisateur sera informé par tout moyen. L'utilisation continue de l'Application après entrée en vigueur vaut acceptation.
          </Text>
        </Section>

        {/* 18. Droit applicable */}
        <Section title="18. Droit applicable – Litiges">
          <Text style={styles.bodyText}>
            Les CGU sont soumises au droit français. En cas de difficulté, l'Utilisateur peut contacter REALMEET pour rechercher une solution amiable :
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@realmeet.fr')}>
            <Text style={styles.emailLink}>contact@realmeet.fr</Text>
          </TouchableOpacity>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            À défaut, les juridictions compétentes seront déterminées selon les règles applicables aux consommateurs.
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
  importantBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  importantText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
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
  inlineLink: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
    fontFamily: 'Manrope_500Medium',
    marginTop: spacing.sm,
    textDecorationLine: 'underline',
  },
});
