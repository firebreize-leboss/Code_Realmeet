// app/auth/signup-individual.tsx
// Écran d'inscription individuel avec sélection d'intention

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { InterestSelector } from '@/components/InterestSelector';
import { IntentionSelector } from '@/components/IntentionSelector';
import { colors } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { storageService } from '@/services/storage.service';
import { UserIntention } from '@/lib/database.types';
import { LinearGradient } from 'expo-linear-gradient';

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
    // Auto-format: DD/MM/YYYY
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
    // Validation des champs obligatoires
    if (!firstName || !lastName || !email || !password || !confirmPassword || !birthDate || !city) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Validation de l'intention
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

    // Validation de la date
    if (birthDate.length !== 10) {
      Alert.alert('Erreur', 'La date doit être au format JJ/MM/AAAA');
      return;
    }

    // Validation de l'âge (au moins 18 ans)
    const [day, month, year] = birthDate.split('/').map(Number);
    const birthYear = year;
    const currentYear = new Date().getFullYear();
    if (currentYear - birthYear < 18) {
      Alert.alert('Erreur', 'Vous devez avoir au moins 18 ans pour créer un compte');
      return;
    }

    setLoading(true);

    try {
      // 1. Vérifier si le username est disponible
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
      const isAvailable = await userService.isUsernameAvailable(username);

      if (!isAvailable) {
        Alert.alert('Erreur', 'Ce nom d\'utilisateur existe déjà');
        setLoading(false);
        return;
      }

      // 2. Créer d'abord le compte (pour avoir l'ID utilisateur)
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

      // 3. Upload de l'avatar si présent
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

      // 4. Mettre à jour le profil avec l'avatar, bio, interests ET intention
      const updateResult = await userService.updateProfile(userId, {
        avatar_url: avatarUrl,
        bio: bio || null,
        interests: interests.length > 0 ? interests : null,
        intention: intention,
      });

      if (!updateResult.success) {
        console.error('❌ Erreur mise à jour profil:', updateResult.error);
      }

      // 5. La connexion est automatique grâce à Supabase !
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
      console.error('❌ Erreur inscription:', error);
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
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Créer un compte</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
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
                  <IconSymbol name="camera.fill" size={32} color="rgba(255,255,255,0.7)" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleImagePick}>
              <Text style={styles.photoText}>Ajouter une photo de profil</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Nom et Prénom */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Prénom *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Jean"
                    placeholderTextColor="rgba(255,255,255,0.5)"
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
                    placeholderTextColor="rgba(255,255,255,0.5)"
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
                <IconSymbol name="calendar" size={20} color="rgba(255,255,255,0.7)" />
                <TextInput
                  style={styles.input}
                  placeholder="JJ/MM/AAAA"
                  placeholderTextColor="rgba(255,255,255,0.5)"
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
                <IconSymbol name="envelope" size={20} color="rgba(255,255,255,0.7)" />
                <TextInput
                  style={styles.input}
                  placeholder="votre.email@exemple.com"
                  placeholderTextColor="rgba(255,255,255,0.5)"
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
                <IconSymbol name="phone.fill" size={20} color="rgba(255,255,255,0.7)" />
                <TextInput
                  style={styles.input}
                  placeholder="+33 6 12 34 56 78"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Ville */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ville *</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="location.fill" size={20} color="rgba(255,255,255,0.7)" />
                <TextInput
                  style={styles.input}
                  placeholder="Paris"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
            </View>

            {/* Intention - OBLIGATOIRE */}
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
              <View style={[styles.inputContainer, styles.textArea]}>
                <TextInput
                  style={[styles.input, styles.textAreaInput]}
                  placeholder="Parlez-nous de vous..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
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
                <IconSymbol name="lock.fill" size={20} color="rgba(255,255,255,0.7)" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <IconSymbol
                    name={showPassword ? "eye.slash.fill" : "eye.fill"}
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>Minimum 6 caractères</Text>
            </View>

            {/* Confirmation mot de passe */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmer le mot de passe *</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="lock.fill" size={20} color="rgba(255,255,255,0.7)" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <IconSymbol
                    name={showConfirmPassword ? "eye.slash.fill" : "eye.fill"}
                    size={20}
                    color="rgba(255,255,255,0.7)"
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

            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#818CF8" />
              ) : (
                <Text style={styles.signupButtonText}>Créer mon compte</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Vous avez déjà un compte ?</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.loginLink}>Se connecter</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoContainer: {
    marginBottom: 12,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  photoText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 12,
  },
  textArea: {
    height: 100,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  textAreaInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  termsSection: {
    marginTop: 8,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  termsText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    textAlign: 'center',
  },
  termsLink: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  signupButton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#818CF8',
  },
  loginSection: {
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 32,
  },
  loginText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  loginLink: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});
