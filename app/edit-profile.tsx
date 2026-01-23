// app/edit-profile.tsx
// Écran d'édition de profil avec intention et personality_tags

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { InterestSelector } from '@/components/InterestSelector';
import { IntentionSelector } from '@/components/IntentionSelector';
import { PersonalityTagsSelector } from '@/components/PersonalityTagsSelector';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/user.service';
import { storageService } from '@/services/storage.service';
import { UserIntention } from '@/lib/database.types';

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
  const [personalityTags, setPersonalityTags] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
      setCity(profile.city || '');
      setPhone(profile.phone || '');
      setInterests(profile.interests || []);
      setIntention(profile.intention || null);
      setPersonalityTags(profile.personality_tags || []);
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
        personality_tags: personalityTags.length > 0 ? personalityTags : null,
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
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleImagePick}>
            <Image
              source={{ uri: profileImage || 'https://via.placeholder.com/120' }}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleImagePick} style={styles.changePhotoButton}>
            <IconSymbol name="camera.fill" size={18} color={colors.primary} />
            <Text style={styles.changePhotoText}>Changer la photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {/* FULL NAME */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom complet</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="person.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.inputInside}
                placeholder="John Doe"
                placeholderTextColor={colors.textSecondary}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          {/* BIO */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.inputContainer, styles.textArea, styles.textInput]}
              placeholder="Parlez-nous de vous..."
              placeholderTextColor={colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* CITY */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ville</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="location.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.inputInside}
                placeholder="Paris"
                placeholderTextColor={colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>

          {/* PHONE */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="phone.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.inputInside}
                placeholder="+33 6 12 34 56 78"
                placeholderTextColor={colors.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* INTENTION */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Je recherche sur RealMeet</Text>
            <IntentionSelector
              selectedIntention={intention}
              onIntentionChange={setIntention}
            />
          </View>

          {/* PERSONALITY TAGS */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Personnalité</Text>
            <PersonalityTagsSelector
              selectedTags={personalityTags}
              onTagsChange={setPersonalityTags}
              maxSelection={5}
            />
          </View>

          {/* INTERESTS */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Centres d'intérêt</Text>
            <InterestSelector
              selectedInterests={interests}
              onInterestsChange={setInterests}
              maxSelection={5}
            />
          </View>
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changePhotoText: {
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
  inputInside: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  textInput: {
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: 16,
  },
  textArea: {
    height: 100,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});