// app/auth/signup-individual.tsx
// Écran d'inscription individuel - Design premium unifié

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { InterestSelector } from '@/components/InterestSelector';
import { IntentionSelector } from '@/components/IntentionSelector';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { storageService } from '@/services/storage.service';
import { UserIntention } from '@/lib/database.types';
import { CityAutocomplete } from '@/components/CityAutocomplete';

export default function SignupIndividualScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [intention, setIntention] = useState<UserIntention>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDateChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = '';
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 2);
      if (cleaned.length > 2) {
        formatted += '/' + cleaned.substring(2, 4);
      }
      if (cleaned.length > 4) {
        formatted += '/' + cleaned.substring(4, 8);
      }
    }
    setBirthDate(formatted);
  };

  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword || !birthDate || !city) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!intention) {
      Alert.alert('Erreur', 'Veuillez indiquer ce que vous recherchez sur RealMeet');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (birthDate.length !== 10) {
      Alert.alert('Erreur', 'La date doit être au format JJ/MM/AAAA');
      return;
    }

    const [day, month, year] = birthDate.split('/').map(Number);
    const birthYear = year;
    const currentYear = new Date().getFullYear();
    if (currentYear - birthYear < 18) {
      Alert.alert('Erreur', 'Vous devez avoir au moins 18 ans pour créer un compte');
      return;
    }

    setLoading(true);

    try {
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
      const isAvailable = await userService.isUsernameAvailable(username);

      if (!isAvailable) {
        Alert.alert('Erreur', 'Ce nom d\'utilisateur existe déjà');
        setLoading(false);
        return;
      }

      const accountResult = await authService.registerUser({
        email,
        password,
        username,
        full_name: `${firstName} ${lastName}`,
        avatar_url: null,
        city,
        date_of_birth: birthDate,
        phone,
      });

      if (!accountResult.success) {
        Alert.alert('Erreur', accountResult.error);
        setLoading(false);
        return;
      }

      const userId = accountResult.user!.id;

      let avatarUrl = null;
      if (profileImage) {
        const uploadResult = await storageService.uploadAvatar(profileImage, userId);
        if (uploadResult.success) {
          avatarUrl = uploadResult.url;
        } else {
          console.error('Erreur upload avatar:', uploadResult.error);
          Alert.alert('Avertissement', 'Votre compte a été créé mais la photo de profil n\'a pas pu être uploadée.');
        }
      }

      const updateResult = await userService.updateProfile(userId, {
        avatar_url: avatarUrl,
        bio: bio || null,
        interests: interests.length > 0 ? interests : null,
        intention: intention,
      });

      if (!updateResult.success) {
        console.error('Erreur mise à jour profil:', updateResult.error);
      }

      Alert.alert(
        'Bienvenue !',
        'Votre compte a été créé avec succès !',
        [
          {
            text: 'Commencer',
            onPress: () => router.replace('/(tabs)/browse')
          }
        ]
      );
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    const result = await storageService.pickImage();
    if (result.success && result.uri) {
      setProfileImage(result.uri);
    } else if (result.error && result.error !== 'Sélection annulée') {
      Alert.alert('Erreur', result.error);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer un compte</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Rejoignez RealMeet</Text>
            <Text style={styles.welcomeSubtitle}>
              Créez votre profil en quelques minutes
            </Text>
          </View>

          {/* Photo de profil */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={handleImagePick}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <IconSymbol name="camera.fill" size={28} color={colors.textTertiary} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <IconSymbol name="plus" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleImagePick}>
              <Text style={styles.photoText}>Ajouter une photo</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Nom et Prénom */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Prénom *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Jean"
                    placeholderTextColor={colors.textMuted}
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Nom *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Dupont"
                    placeholderTextColor={colors.textMuted}
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>
            </View>

            {/* Date de naissance */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date de naissance *</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="calendar" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="JJ/MM/AAAA"
                  placeholderTextColor={colors.textMuted}
                  value={birthDate}
                  onChangeText={handleDateChange}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <Text style={styles.helperText}>Vous devez avoir au moins 18 ans</Text>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="envelope" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="votre.email@exemple.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Téléphone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Téléphone</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="phone.fill" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="+33 6 12 34 56 78"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Ville */}
            <View style={styles.inputGroup}>
              <CityAutocomplete
                value={city}
                onCitySelect={(result) => setCity(result.city)}
                placeholder="Rechercher une ville..."
                label="Ville *"
              />
            </View>

            {/* Intention */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Je recherche sur RealMeet *</Text>
              <IntentionSelector
                selectedIntention={intention}
                onIntentionChange={setIntention}
                required
              />
            </View>

            {/* Bio */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Parlez-nous de vous..."
                placeholderTextColor={colors.textMuted}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>Optionnel - Décrivez-vous en quelques mots</Text>
            </View>

            {/* Centres d'intérêt */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Centres d'intérêt</Text>
              <InterestSelector
                selectedInterests={interests}
                onInterestsChange={setInterests}
                maxSelection={5}
              />
            </View>

            {/* Mot de passe */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe *</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="lock.fill" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <IconSymbol
                    name={showPassword ? "eye.slash.fill" : "eye.fill"}
                    size={18}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>Minimum 6 caractères</Text>
            </View>

            {/* Confirmation mot de passe */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmer le mot de passe *</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="lock.fill" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <IconSymbol
                    name={showConfirmPassword ? "eye.slash.fill" : "eye.fill"}
                    size={18}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Conditions d'utilisation */}
            <View style={styles.termsSection}>
              <Text style={styles.termsText}>
                En créant un compte, vous acceptez nos{' '}
                <Text style={styles.termsLink}>Conditions d'utilisation</Text>
                {' '}et notre{' '}
                <Text style={styles.termsLink}>Politique de confidentialité</Text>
              </Text>
            </View>

            {/* Signup Button */}
            <TouchableOpacity
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.signupButtonText}>Créer mon compte</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Vous avez déjà un compte ?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.borderLight,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.backgroundAlt,
  },
  photoText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
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
  textArea: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  termsSection: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
  signupButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  signupButtonDisabled: {
    opacity: 0.7,
  },
  signupButtonText: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.textOnPrimary,
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxl,
  },
  loginText: {
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
});
