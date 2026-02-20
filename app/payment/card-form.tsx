// app/payment/card-form.tsx
// Page de saisie carte bancaire avec preview visuelle

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CreditCard, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows } from '@/styles/commonStyles';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

export default function CardFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const price = typeof params.price === 'string' ? params.price : '0€';

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  // États du formulaire
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // États de focus
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Formater le prix pour l'affichage
  const formatPrice = (priceStr: string) => {
    const numericPrice = parseFloat(priceStr.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (isNaN(numericPrice) || numericPrice === 0) return 'Gratuit';
    return numericPrice.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    });
  };

  const formattedPrice = formatPrice(price);

  // Formatage du numéro de carte (espaces tous les 4 chiffres)
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 16);
    const groups = limited.match(/.{1,4}/g);
    return groups ? groups.join(' ') : '';
  };

  // Formatage de la date d'expiration (MM/AA)
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 4);
    if (limited.length >= 3) {
      return `${limited.slice(0, 2)}/${limited.slice(2)}`;
    }
    return limited;
  };

  // Handlers
  const handleCardNumberChange = (text: string) => {
    setCardNumber(formatCardNumber(text));
  };

  const handleExpiryChange = (text: string) => {
    // Gérer la suppression du slash
    if (text.length < expiry.length && expiry.endsWith('/')) {
      setExpiry(text.replace('/', ''));
      return;
    }
    setExpiry(formatExpiry(text));
  };

  const handleCvcChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    setCvc(cleaned.slice(0, 4));
  };

  // Validation
  const validation = useMemo(() => {
    const cardDigits = cardNumber.replace(/\s/g, '');
    const isCardValid = cardDigits.length === 16;

    const expiryParts = expiry.split('/');
    let isExpiryValid = false;
    if (expiryParts.length === 2) {
      const month = parseInt(expiryParts[0], 10);
      const year = parseInt(expiryParts[1], 10);
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const currentMonth = now.getMonth() + 1;

      isExpiryValid =
        month >= 1 &&
        month <= 12 &&
        (year > currentYear || (year === currentYear && month >= currentMonth));
    }

    const isCvcValid = cvc.length >= 3 && cvc.length <= 4;
    const isNameValid = cardholderName.trim().length > 0;

    return {
      cardNumber: isCardValid,
      expiry: isExpiryValid,
      cvc: isCvcValid,
      cardholderName: isNameValid,
      isFormValid: isCardValid && isExpiryValid && isCvcValid && isNameValid,
    };
  }, [cardNumber, expiry, cvc, cardholderName]);

  // Simuler le paiement
  const handlePayment = async () => {
    if (!validation.isFormValid || isProcessing) return;

    setIsProcessing(true);

    // Simuler un délai de traitement
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsProcessing(false);

    // Naviguer vers la confirmation
    router.push({
      pathname: '/payment/confirmation',
      params: {
        ...params,
      },
    });
  };

  // Affichage du numéro de carte sur la preview
  const displayCardNumber = cardNumber || '•••• •••• •••• ••••';
  const displayExpiry = expiry || 'MM/AA';
  const displayName = cardholderName || 'NOM DU TITULAIRE';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carte bancaire</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Montant */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Montant à payer</Text>
            <Text style={styles.amountValue}>{formattedPrice}</Text>
          </View>

          {/* Preview de la carte */}
          <View style={styles.cardPreviewContainer}>
            <LinearGradient
              colors={['#6C63FF', '#9C27B0', '#FF6B9D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardPreview}
            >
              <View style={styles.cardChip}>
                <View style={styles.cardChipInner} />
              </View>

              <Text style={styles.cardPreviewNumber}>{displayCardNumber}</Text>

              <View style={styles.cardPreviewBottom}>
                <View style={styles.cardPreviewField}>
                  <Text style={styles.cardPreviewLabel}>TITULAIRE</Text>
                  <Text style={styles.cardPreviewValue} numberOfLines={1}>
                    {displayName.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardPreviewField}>
                  <Text style={styles.cardPreviewLabel}>EXPIRE</Text>
                  <Text style={styles.cardPreviewValue}>{displayExpiry}</Text>
                </View>
              </View>

              <CreditCard
                size={32}
                color="rgba(255,255,255,0.3)"
                style={styles.cardIcon}
              />
            </LinearGradient>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            {/* Numéro de carte */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Numéro de carte</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'cardNumber' && styles.inputFocused,
                  cardNumber.length > 0 && !validation.cardNumber && styles.inputError,
                ]}
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={19}
                onFocus={() => setFocusedField('cardNumber')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Ligne expiration + CVC */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.inputLabel}>Date d'expiration</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'expiry' && styles.inputFocused,
                    expiry.length > 0 && !validation.expiry && styles.inputError,
                  ]}
                  value={expiry}
                  onChangeText={handleExpiryChange}
                  placeholder="MM/AA"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={5}
                  onFocus={() => setFocusedField('expiry')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.inputLabel}>CVC</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'cvc' && styles.inputFocused,
                    cvc.length > 0 && !validation.cvc && styles.inputError,
                  ]}
                  value={cvc}
                  onChangeText={handleCvcChange}
                  placeholder="123"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  onFocus={() => setFocusedField('cvc')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Nom du titulaire */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom du titulaire</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'cardholderName' && styles.inputFocused,
                ]}
                value={cardholderName}
                onChangeText={setCardholderName}
                placeholder="Nom sur la carte"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                onFocus={() => setFocusedField('cardholderName')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Info sécurité */}
          <View style={styles.securityInfo}>
            <Lock size={16} color={colors.textTertiary} />
            <Text style={styles.securityText}>
              Paiement sécurisé par chiffrement SSL
            </Text>
          </View>
        </ScrollView>

        {/* Bouton Payer (sticky) */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <TouchableOpacity
            style={[
              styles.payButton,
              !validation.isFormValid && styles.payButtonDisabled,
            ]}
            onPress={handlePayment}
            disabled={!validation.isFormValid || isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : validation.isFormValid ? (
              <LinearGradient
                colors={['#6C63FF', '#9C27B0', '#FF6B9D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payButtonGradient}
              >
                <Text style={styles.payButtonText}>Payer {formattedPrice}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.payButtonTextDisabled}>Payer {formattedPrice}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
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
  },

  // Amount
  amountContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  amountLabel: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  amountValue: {
    fontSize: typography.xxxl,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
  },

  // Card Preview
  cardPreviewContainer: {
    marginBottom: spacing.xxl,
    ...shadows.lg,
  },
  cardPreview: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    aspectRatio: 1.586, // Ratio standard carte bancaire
    position: 'relative',
  },
  cardChip: {
    width: 40,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 6,
    marginBottom: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardChipInner: {
    width: 28,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
  },
  cardPreviewNumber: {
    fontSize: 22,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },
  cardPreviewBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  cardPreviewField: {
    flex: 1,
  },
  cardPreviewLabel: {
    fontSize: 10,
    fontFamily: 'Manrope_500Medium',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
    letterSpacing: 1,
  },
  cardPreviewValue: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  cardIcon: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
  },

  // Form
  form: {
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundAlt,
  },
  inputError: {
    borderColor: colors.error,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  inputHalf: {
    flex: 1,
  },

  // Security Info
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  securityText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    backgroundColor: colors.backgroundAlt,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  payButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
  },
  payButtonDisabled: {
    backgroundColor: colors.borderLight,
  },
  payButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
  payButtonTextDisabled: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textMuted,
  },
});
