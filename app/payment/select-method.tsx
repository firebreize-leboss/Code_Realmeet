// app/payment/select-method.tsx
// Page de sélection du mode de paiement

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CreditCard, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius, shadows } from '@/styles/commonStyles';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

export default function SelectMethodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const activityName = typeof params.activity_name === 'string' ? params.activity_name : '';
  const slotDate = typeof params.slot_date === 'string' ? params.slot_date : '';
  const slotTime = typeof params.slot_time === 'string' ? params.slot_time : '';
  const price = typeof params.price === 'string' ? params.price : '0€';

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  // Formater le prix pour l'affichage (ex: "12€" -> "12,00 €")
  const formatPrice = (priceStr: string) => {
    const numericPrice = parseFloat(priceStr.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (isNaN(numericPrice) || numericPrice === 0) return 'Gratuit';
    return numericPrice.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    });
  };

  const formattedPrice = formatPrice(price);

  const handleCardPayment = () => {
    router.push({
      pathname: '/payment/card-form',
      params: {
        ...params,
      },
    });
  };

  const paymentMethods = [
    {
      id: 'card',
      label: 'Carte bancaire',
      icon: CreditCard,
      enabled: true,
      onPress: handleCardPayment,
    },
    {
      id: 'apple_pay',
      label: 'Apple Pay',
      icon: Smartphone,
      enabled: false,
      badge: 'Bientôt',
    },
    {
      id: 'google_pay',
      label: 'Google Pay',
      icon: Smartphone,
      enabled: false,
      badge: 'Bientôt',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Récap de l'activité */}
        <View style={styles.recapCard}>
          <Text style={styles.recapActivityName}>{activityName}</Text>
          <Text style={styles.recapDetails}>
            {slotDate} à {slotTime}
          </Text>
          <View style={styles.recapPriceContainer}>
            <Text style={styles.recapPriceLabel}>Total à payer</Text>
            <Text style={styles.recapPrice}>{formattedPrice}</Text>
          </View>
        </View>

        {/* Section choix du moyen de paiement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choisir un moyen de paiement</Text>

          <View style={styles.methodsList}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodRow,
                  !method.enabled && styles.methodRowDisabled,
                ]}
                onPress={method.enabled ? method.onPress : undefined}
                disabled={!method.enabled}
                activeOpacity={method.enabled ? 0.7 : 1}
              >
                <View style={[
                  styles.methodIconContainer,
                  !method.enabled && styles.methodIconContainerDisabled,
                ]}>
                  <method.icon
                    size={22}
                    color={method.enabled ? colors.primary : colors.textMuted}
                  />
                </View>

                <Text style={[
                  styles.methodLabel,
                  !method.enabled && styles.methodLabelDisabled,
                ]}>
                  {method.label}
                </Text>

                {method.badge ? (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>{method.badge}</Text>
                  </View>
                ) : (
                  <ChevronRight size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Info sécurité */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityText}>
            Paiement sécurisé. Vos données bancaires sont protégées.
          </Text>
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

  // Header
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },

  // Récap Card
  recapCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    ...shadows.md,
  },
  recapActivityName: {
    fontSize: typography.lg,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  recapDetails: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  recapPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  recapPriceLabel: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
  recapPrice: {
    fontSize: typography.xl,
    fontFamily: 'Manrope_700Bold',
    color: colors.primary,
  },

  // Section
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: spacing.lg,
  },

  // Methods List
  methodsList: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  methodRowDisabled: {
    opacity: 0.6,
  },
  methodIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  methodIconContainerDisabled: {
    backgroundColor: colors.borderSubtle,
  },
  methodLabel: {
    flex: 1,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  methodLabelDisabled: {
    color: colors.textMuted,
  },
  comingSoonBadge: {
    backgroundColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  comingSoonText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
  },

  // Security Info
  securityInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  securityText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
