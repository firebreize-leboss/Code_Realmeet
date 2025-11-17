import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';

export default function AccountTypeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Bienvenue sur</Text>
          <Text style={styles.brandName}>RealMeet</Text>
          <Text style={styles.subtitle}>
            Choisissez votre type de compte
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* Card Particulier */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/auth/login-individual')}
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
              Organisez des événements professionnels et développez votre réseau
            </Text>
            <View style={styles.cardFeatures}>
              <View style={styles.feature}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
                <Text style={styles.featureText}>Événements B2B</Text>
              </View>
              <View style={styles.feature}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
                <Text style={styles.featureText}>Outils analytics</Text>
              </View>
              <View style={styles.feature}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
                <Text style={styles.featureText}>Support prioritaire</Text>
              </View>
            </View>
            <View style={[styles.continueButton, { backgroundColor: colors.secondary }]}>
              <Text style={styles.continueButtonText}>Continuer</Text>
              <IconSymbol name="chevron.right" size={20} color={colors.background} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  cardFeatures: {
    gap: 12,
    marginBottom: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});