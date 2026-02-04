// app/edit-profile.tsx
// Écran d'édition de profil avec intention
// Design premium unifié avec le reste de l'app

import React, { useState, useEffect } from 'react';
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

import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/user.service';
import { storageService } from '@/services/storage.service';
import { UserIntention } from '@/lib/database.types';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [intention, setIntention] = useState<UserIntention>(null);

  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
      setCity(profile.city || '');
      setPhone(profile.phone || '');
      setInterests(profile.interests || []);
      setIntention(profile.intention || null);

      setProfileImage(profile.avatar_url);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user || !fullName.trim()) {
      Alert.alert('Erreur', 'Le nom complet est requis');
      return;
    }

    setLoading(true);

    try {
      let avatarUrl = profileImage;

      // Si nouvelle image sélectionnée (URI locale)
      if (profileImage && profileImage.startsWith('file://')) {
        const uploadResult = await storageService.uploadAvatar(profileImage, user.id);
        if (uploadResult.success) {
          avatarUrl = uploadResult.url;
        } else {
          Alert.alert('Erreur', uploadResult.error || 'Erreur upload image');
          setLoading(false);
          return;
        }
      }

      const result = await userService.updateProfile(user.id, {
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        city: city.trim() || null,
        phone: phone.trim() || null,
        interests: interests.length > 0 ? interests : null,
        intention: intention,

        avatar_url: avatarUrl,
      });

      if (result.success) {
        await refreshProfile();
        Alert.alert('Succès', 'Profil mis à jour !', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Erreur', result.error || 'Erreur lors de la mise à jour');
      }
    } catch (error: any) {
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier le profil</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handleImagePick} style={styles.avatarWrapper}>
              <Image
                source={{ uri: profileImage || 'https://via.placeholder.com/120' }}
                style={styles.avatar}
              />
              <View style={styles.cameraBadge}>
                <IconSymbol name="camera.fill" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleImagePick} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoText}>Changer la photo</Text>
            </TouchableOpacity>
          </View>

          {/* FULL NAME */}
          <View style={styles.fieldSection}>
            <Text style={styles.label}>Nom complet</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="person.fill" size={18} color={colors.textTertiary} />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          {/* BIO */}
          <View style={styles.fieldSection}>
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
          </View>

          {/* CITY */}
          <View style={styles.fieldSection}>
            <Text style={styles.label}>Ville</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="location.fill" size={18} color={colors.textTertiary} />
              <TextInput
                style={styles.input}
                placeholder="Paris"
                placeholderTextColor={colors.textMuted}
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>

          {/* PHONE */}
          <View style={styles.fieldSection}>
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

          {/* INTENTION */}
          <View style={styles.fieldSection}>
            <Text style={styles.label}>Je recherche sur RealMeet</Text>
            <IntentionSelector
              selectedIntention={intention}
              onIntentionChange={setIntention}
            />
          </View>

          {/* INTERESTS */}
          <View style={styles.fieldSection}>
            <Text style={styles.label}>Centres d'intérêt</Text>
            <InterestSelector
              selectedInterests={interests}
              onInterestsChange={setInterests}
              maxSelection={5}
            />
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
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

  // Header - cohérent avec Settings
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

  // ScrollView
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },

  // Avatar Section - plus chaleureux et visible
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.borderLight,
    borderWidth: 4,
    borderColor: colors.backgroundAlt,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.backgroundAlt,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  changePhotoButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  changePhotoText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    fontWeight: typography.semibold,
    color: colors.primary,
  },

  // Field Section - structure claire sans bulles imbriquées
  fieldSection: {
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

  // Input - fond gris clair avec bordure fine
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
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    paddingVertical: spacing.md,
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

  // Save button - accent orange
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.textOnPrimary,
  },
});
