// app/auth/register-business.tsx
// Page d'inscription entreprise - Design premium unifié

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

const BUSINESS_CATEGORIES = [
  'Sport & Fitness',
  'Art & Culture',
  'Gastronomie',
  'Bien-être & Spa',
  'Aventure & Nature',
  'Éducation & Formation',
  'Musique & Spectacle',
  'Technologie',
  'Mode & Beauté',
  'Autre',
];

export default function RegisterBusinessScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Step 1: Account credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Business info
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [siret, setSiret] = useState('');

  // Step 3: Contact info
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const validateEmail = (emailToTest: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailToTest);
  };

  const validateStep1 = () => {
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail) {
      Alert.alert('Erreur', 'L\'email est requis');
      return false;
    }
    if (!validateEmail(cleanedEmail)) {
      Alert.alert('Erreur', 'Format d\'email invalide. Exemple: contact@entreprise.com');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!businessName.trim()) {
      Alert.alert('Erreur', 'Le nom de l\'entreprise est requis');
      return false;
    }
    if (!businessCategory) {
      Alert.alert('Erreur', 'Veuillez sélectionner une catégorie');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!contactName.trim()) {
      Alert.alert('Erreur', 'Le nom du contact est requis');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      handleRegister();
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const cleanedEmail = email.trim().toLowerCase();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanedEmail,
        password: password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }
      if (!authData.user) throw new Error('Erreur lors de la création du compte');

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: businessName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          full_name: contactName.trim(),
          city: city.trim() || null,
          phone: phone.trim() || null,
          account_type: 'business',
          business_name: businessName.trim(),
          business_category: businessCategory,
          business_siret: siret.trim() || null,
          business_address: address.trim() || null,
          business_phone: phone.trim() || null,
          business_email: cleanedEmail,
        });

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }

      Alert.alert(
        'Compte créé !',
        'Votre compte entreprise a été créé avec succès. Vous pouvez maintenant vous connecter.',
        [
          {
            text: 'Se connecter',
            onPress: () => router.replace('/auth/login-business'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Registration error:', error);
      let message = 'Erreur lors de l\'inscription';
      if (error.message?.includes('already registered')) {
        message = 'Cet email est déjà utilisé';
      } else if (error.message?.includes('invalid format')) {
        message = 'Format d\'email invalide';
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Erreur', message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <View
            style={[
              styles.stepDot,
              step >= s && styles.stepDotActive,
              step === s && styles.stepDotCurrent,
            ]}
          >
            {step > s ? (
              <IconSymbol name="checkmark" size={14} color={colors.primary} />
            ) : (
              <Text style={[styles.stepNumber, step >= s && styles.stepNumberActive]}>
                {s}
              </Text>
            )}
          </View>
          {s < 3 && (
            <View style={[styles.stepLine, step > s && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Créer votre compte</Text>
      <Text style={styles.stepSubtitle}>
        Commençons par vos identifiants de connexion
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email professionnel</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="envelope.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="contact@entreprise.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Mot de passe</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="lock.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <IconSymbol
              name={showPassword ? 'eye.slash.fill' : 'eye.fill'}
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirmer le mot de passe</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="lock.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
          />
        </View>
      </View>

      <View style={styles.passwordHints}>
        <View style={styles.hintRow}>
          <IconSymbol
            name={password.length >= 6 ? 'checkmark.circle.fill' : 'circle'}
            size={16}
            color={password.length >= 6 ? colors.success : colors.textMuted}
          />
          <Text style={styles.hintText}>Au moins 6 caractères</Text>
        </View>
        <View style={styles.hintRow}>
          <IconSymbol
            name={password === confirmPassword && password.length > 0 ? 'checkmark.circle.fill' : 'circle'}
            size={16}
            color={password === confirmPassword && password.length > 0 ? colors.success : colors.textMuted}
          />
          <Text style={styles.hintText}>Les mots de passe correspondent</Text>
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Votre entreprise</Text>
      <Text style={styles.stepSubtitle}>
        Parlez-nous de votre activité
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nom de l'entreprise *</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="building.2.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Nom de votre entreprise"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Catégorie *</Text>
        <TouchableOpacity
          style={styles.selectContainer}
          onPress={() => setShowCategoryPicker(true)}
        >
          <IconSymbol name="square.stack.3d.up.fill" size={18} color={colors.textTertiary} />
          <Text style={businessCategory ? styles.selectText : styles.selectPlaceholder}>
            {businessCategory || 'Sélectionner une catégorie'}
          </Text>
          <IconSymbol name="chevron.down" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Numéro SIRET (optionnel)</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="doc.text.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={siret}
            onChangeText={setSiret}
            placeholder="123 456 789 01234"
            placeholderTextColor={colors.textMuted}
            keyboardType="default"
            maxLength={20}
          />
        </View>
        <Text style={styles.helperText}>
          Optionnel - Vous pourrez l'ajouter plus tard pour faire vérifier votre compte
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Coordonnées</Text>
      <Text style={styles.stepSubtitle}>
        Comment vous contacter ?
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nom du contact principal *</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="person.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={contactName}
            onChangeText={setContactName}
            placeholder="Prénom Nom"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Téléphone</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="phone.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+33 X XX XX XX XX"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Adresse</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="location.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Adresse de l'établissement"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Ville</Text>
        <View style={styles.inputContainer}>
          <IconSymbol name="map.fill" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Ville"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.termsSection}>
        <Text style={styles.termsText}>
          En créant un compte, vous acceptez nos{' '}
          <Text style={styles.termsLink}>Conditions d'utilisation</Text>
          {' '}et notre{' '}
          <Text style={styles.termsLink}>Politique de confidentialité</Text>
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
              style={styles.backButton}
            >
              <IconSymbol name="chevron.left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Inscription Entreprise</Text>
            <View style={styles.headerSpacer} />
          </View>

          {renderStepIndicator()}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.nextButtonDisabled]}
              onPress={handleNextStep}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {step === 3 ? 'Créer mon compte' : 'Continuer'}
                  </Text>
                  {step < 3 && (
                    <IconSymbol name="chevron.right" size={18} color="#FFFFFF" />
                  )}
                </>
              )}
            </TouchableOpacity>

            {step === 1 && (
              <View style={styles.loginPrompt}>
                <Text style={styles.loginPromptText}>Déjà un compte ?</Text>
                <TouchableOpacity onPress={() => router.push('/auth/login-business')}>
                  <Text style={styles.loginLink}>Se connecter</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Category Picker Modal */}
          {showCategoryPicker && (
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                style={styles.modalBackdrop}
                activeOpacity={1}
                onPress={() => setShowCategoryPicker(false)}
              />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Catégorie d'activité</Text>
                  <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                    <IconSymbol name="xmark" size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScroll}>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOption,
                        businessCategory === cat && styles.categoryOptionSelected,
                      ]}
                      onPress={() => {
                        setBusinessCategory(cat);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          businessCategory === cat && styles.categoryOptionTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                      {businessCategory === cat && (
                        <IconSymbol name="checkmark" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
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
  headerSpacer: {
    width: 36,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxxl,
    backgroundColor: colors.backgroundAlt,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.inputBackground,
    borderWidth: 2,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  stepDotCurrent: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  stepNumber: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textMuted,
  },
  stepNumberActive: {
    color: colors.primary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.sm,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  helperText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  selectText: {
    flex: 1,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.textMuted,
  },
  passwordHints: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hintText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
  },
  termsSection: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.sm,
  },
  termsText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  termsLink: {
    color: colors.primary,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
  },
  bottomActions: {
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
    backgroundColor: colors.backgroundAlt,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  nextButtonDisabled: {
    opacity: 0.7,
  },
  nextButtonText: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.textOnPrimary,
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  loginPromptText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  modalContent: {
    backgroundColor: colors.backgroundAlt,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  categoryOptionSelected: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  categoryOptionText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  categoryOptionTextSelected: {
    color: colors.primary,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
  },
});
