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
import { colors } from '@/styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function AccountTypeScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
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
              activeOpacity={0.8}
            >
              <View style={styles.iconContainer}>
                <IconSymbol name="person.fill" size={48} color="#FFFFFF" />
              </View>
              <Text style={styles.cardTitle}>Particulier</Text>
              <Text style={styles.cardDescription}>
                Rejoignez des activités et rencontrez de nouvelles personnes
              </Text>
              <View style={styles.cardFeatures}>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Rejoindre des activités</Text>
                </View>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Créer vos événements</Text>
                </View>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Messagerie intégrée</Text>
                </View>
              </View>
              <View style={styles.continueButton}>
                <Text style={styles.continueButtonText}>Continuer</Text>
                <IconSymbol name="chevron.right" size={20} color="#818CF8" />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Card Entreprise */}
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push('/auth/login-business')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, styles.iconContainerBusiness]}>
                <IconSymbol name="building.2.fill" size={48} color="#FFFFFF" />
              </View>
              <Text style={styles.cardTitle}>Entreprise</Text>
              <Text style={styles.cardDescription}>
                Développez votre activité avec des événements professionnels
              </Text>
              <View style={styles.cardFeatures}>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Créer des événements pro</Text>
                </View>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Analytics avancés</Text>
                </View>
                <View style={styles.feature}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Gestion des participants</Text>
                </View>
              </View>
              <View style={[styles.continueButton, styles.continueButtonBusiness]}>
                <Text style={styles.continueButtonText}>Continuer</Text>
                <IconSymbol name="chevron.right" size={20} color="#C084FC" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  iconContainerBusiness: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  cardDescription: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  cardFeatures: {
    gap: 14,
    marginBottom: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  continueButtonBusiness: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#818CF8',
  },
});