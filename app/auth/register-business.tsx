// app/auth/register-business.tsx
// Page d'inscription pour les comptes entreprise

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
import { colors, commonStyles } from '@/styles/commonStyles';
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
      // Nettoyer l'email
      const cleanedEmail = email.trim().toLowerCase();
      
      // 1. Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanedEmail,
        password: password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }
      if (!authData.user) throw new Error('Erreur lors de la création du compte');

      // 2. Create business profile
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
              <IconSymbol name="checkmark" size={14} color={colors.background} />
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
        <Text style={styles.inputLabel}>Email professionnel</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="envelope.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="contact@entreprise.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Mot de passe</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="lock.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <IconSymbol
              name={showPassword ? 'eye.slash.fill' : 'eye.fill'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="lock.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={!showPassword}
          />
        </View>
      </View>

      <View style={styles.passwordHints}>
        <View style={styles.hintRow}>
          <IconSymbol
            name={password.length >= 6 ? 'checkmark.circle.fill' : 'circle'}
            size={16}
            color={password.length >= 6 ? '#10B981' : colors.textSecondary}
          />
          <Text style={styles.hintText}>Au moins 6 caractères</Text>
        </View>
        <View style={styles.hintRow}>
          <IconSymbol
            name={password === confirmPassword && password.length > 0 ? 'checkmark.circle.fill' : 'circle'}
            size={16}
            color={password === confirmPassword && password.length > 0 ? '#10B981' : colors.textSecondary}
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
        <Text style={styles.inputLabel}>Nom de l'entreprise *</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="building.2.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Nom de votre entreprise"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Catégorie *</Text>
        <TouchableOpacity
          style={styles.selectWrapper}
          onPress={() => setShowCategoryPicker(true)}
        >
          <IconSymbol name="square.stack.3d.up.fill" size={20} color={colors.textSecondary} />
          <Text style={businessCategory ? styles.selectText : styles.selectPlaceholder}>
            {businessCategory || 'Sélectionner une catégorie'}
          </Text>
          <IconSymbol name="chevron.down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Numéro SIRET (optionnel)</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="doc.text.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={siret}
            onChangeText={setSiret}
            placeholder="123 456 789 01234"
            placeholderTextColor={colors.textSecondary}
            keyboardType="default"
            maxLength={20}
          />
        </View>
        <Text style={styles.inputHint}>
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
        <Text style={styles.inputLabel}>Nom du contact principal *</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="person.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={contactName}
            onChangeText={setContactName}
            placeholder="Prénom Nom"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Téléphone</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="phone.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+33 X XX XX XX XX"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Adresse</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="location.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Adresse de l'établissement"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Ville</Text>
        <View style={styles.inputWrapper}>
          <IconSymbol name="map.fill" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Ville"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.termsContainer}>
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
    <SafeAreaView style={commonStyles.container} edges={['top']}>
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
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inscription Entreprise</Text>
          <View style={styles.placeholder} />
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
            style={styles.nextButton}
            onPress={handleNextStep}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {step === 3 ? 'Créer mon compte' : 'Continuer'}
                </Text>
                {step < 3 && (
                  <IconSymbol name="chevron.right" size={20} color={colors.background} />
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
                  <IconSymbol name="xmark" size={24} color={colors.text} />
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
                      <IconSymbol name="checkmark" size={20} color={colors.secondary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  stepDotCurrent: {
    borderColor: colors.secondary,
    borderWidth: 3,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepNumberActive: {
    color: colors.background,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: colors.secondary,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text,
  },
  inputHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    marginLeft: 4,
  },
  selectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: colors.textSecondary,
  },
  passwordHints: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hintText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  termsContainer: {
    marginTop: 8,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  termsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.secondary,
    fontWeight: '600',
  },
  bottomActions: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  nextButton: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  loginPromptText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.secondary,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalScroll: {
    padding: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryOptionSelected: {
    backgroundColor: colors.secondary + '10',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  categoryOptionTextSelected: {
    color: colors.secondary,
    fontWeight: '600',
  },
});