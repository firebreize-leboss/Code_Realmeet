// app/auth/account-type.tsx
// Page de sélection du type de compte avec connexion séparée

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';

export default function AccountTypeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Bienvenue sur RealMeet</Text>
          <Text style={styles.subtitle}>
            Choisissez votre type de compte pour continuer
          </Text>
        </View>

        {/* Card Particulier */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/auth/login')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <IconSymbol name="person.fill" size={48} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Particulier</Text>
          <Text style={styles.cardDescription}>
            Rejoignez des activités et rencontrez de nouvelles personnes
          </Text>
          <View style={styles.cardFeatures}>
            <View style={styles.feature}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
              <Text style={styles.featureText}>Rejoindre des activités</Text>
            </View>
            <View style={styles.feature}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
              <Text style={styles.featureText}>Créer vos événements</Text>
            </View>
            <View style={styles.feature}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
              <Text style={styles.featureText}>Messagerie intégrée</Text>
            </View>
          </View>
          <View style={styles.continueButton}>
            <Text style={styles.continueButtonText}>Continuer</Text>
            <IconSymbol name="chevron.right" size={20} color={colors.background} />
          </View>
        </TouchableOpacity>

        {/* Card Entreprise */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/auth/login-business')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.secondary + '20' }]}>
            <IconSymbol name="building.2.fill" size={48} color={colors.secondary} />
          </View>
          <Text style={styles.cardTitle}>Entreprise</Text>
          <Text style={styles.cardDescription}>
            Développez votre activité avec des événements professionnels
          </Text>
          <View style={styles.cardFeatures}>
            <View style={styles.feature}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
              <Text style={styles.featureText}>Créer des événements pro</Text>
            </View>
            <View style={styles.feature}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
              <Text style={styles.featureText}>Analytics avancés</Text>
            </View>
            <View style={styles.feature}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
              <Text style={styles.featureText}>Gestion des participants</Text>
            </View>
          </View>
          <View style={[styles.continueButton, { backgroundColor: colors.secondary }]}>
            <Text style={styles.continueButtonText}>Continuer</Text>
            <IconSymbol name="chevron.right" size={20} color={colors.background} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  cardFeatures: {
    gap: 12,
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: colors.text,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});