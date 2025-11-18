import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { storageService } from '@/services/storage.service';
import { userService } from '@/services/user.service';

export default function SignupIndividualScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [interest, setInterest] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Formatter la date automatiquement
  const handleDateChange = (text: string) => {
    // Supprimer tout sauf les chiffres
    const cleaned = text.replace(/[^\d]/g, '');
    
    // Formatter en JJ/MM/AAAA
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

  // Ajouter un centre d'intérêt
  const handleAddInterest = () => {
    if (interest.trim() && !interests.includes(interest.trim())) {
      setInterests([...interests, interest.trim()]);
      setInterest('');
    }
  };

  // Supprimer un centre d'intérêt
  const handleRemoveInterest = (indexToRemove: number) => {
    setInterests(interests.filter((_, index) => index !== indexToRemove));
  };

  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword || !birthDate || !city) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
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
        avatar_url: null, // On l'ajoutera après
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
        console.log('🔵 Début upload avatar...');
        const uploadResult = await storageService.uploadAvatar(
          profileImage,
          userId
        );
        if (uploadResult.success) {
          avatarUrl = uploadResult.url;
          console.log('✅ Avatar uploadé:', avatarUrl);
        } else {
          console.error('❌ Erreur upload avatar:', uploadResult.error);
          Alert.alert('Avertissement', 'Votre compte a été créé mais la photo de profil n\'a pas pu être uploadée.');
        }
      }

      // 4. Mettre à jour le profil avec l'avatar, bio et interests
      const updateResult = await userService.updateProfile(userId, {
        avatar_url: avatarUrl,
        bio: bio || null,
        interests: interests.length > 0 ? interests : null,
      });

      if (!updateResult.success) {
        console.error('❌ Erreur mise à jour profil:', updateResult.error);
      }

      // 5. La connexion est automatique grâce à Supabase !
      // On redirige directement
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
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
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
                <IconSymbol name="camera.fill" size={32} color={colors.textSecondary} />
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
                  placeholderTextColor={colors.textSecondary}
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
                  placeholderTextColor={colors.textSecondary}
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
              <IconSymbol name="calendar" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="JJ/MM/AAAA"
                placeholderTextColor={colors.textSecondary}
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
              <IconSymbol name="envelope" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="votre.email@exemple.com"
                placeholderTextColor={colors.textSecondary}
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
              <IconSymbol name="phone.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="+33 6 12 34 56 78"
                placeholderTextColor={colors.textSecondary}
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
              <IconSymbol name="location.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Paris"
                placeholderTextColor={colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>

          {/* Bio */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.inputContainer, styles.textArea]}
              placeholder="Parlez-nous de vous..."
              placeholderTextColor={colors.textSecondary}
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
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ex: Randonnée, Cuisine, Musique..."
                placeholderTextColor={colors.textSecondary}
                value={interest}
                onChangeText={setInterest}
                onSubmitEditing={handleAddInterest}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleAddInterest}>
                <IconSymbol name="plus.circle.fill" size={28} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {interests.length > 0 && (
              <View style={styles.interestsContainer}>
                {interests.map((item, index) => (
                  <View key={index} style={styles.interestBadge}>
                    <Text style={styles.interestText}>{item}</Text>
                    <TouchableOpacity onPress={() => handleRemoveInterest(index)}>
                      <IconSymbol name="xmark" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.helperText}>Appuyez sur + pour ajouter un intérêt</Text>
          </View>

          {/* Mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe *</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="lock.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <IconSymbol
                  name={showPassword ? "eye.slash.fill" : "eye.fill"}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              Minimum 6 caractères
            </Text>
          </View>

          {/* Confirmation mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmer le mot de passe *</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="lock.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <IconSymbol
                  name={showConfirmPassword ? "eye.slash.fill" : "eye.fill"}
                  size={20}
                  color={colors.textSecondary}
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
              <ActivityIndicator color={colors.background} />
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
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
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
    color: colors.text,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
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
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.border,
  },
  photoText: {
    fontSize: 15,
    color: colors.primary,
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
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  textArea: {
    height: 100,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  interestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  termsSection: {
    marginTop: 8,
  },
  termsText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  signupButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  loginSection: {
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 32,
  },
  loginText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loginLink: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});