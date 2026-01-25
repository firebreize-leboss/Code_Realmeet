// app/edit-profile.tsx
// Écran d'édition de profil avec intention et personality_tags
// Design Glassmorphism comme profile.tsx

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
import { PersonalityTagsSelector } from '@/components/PersonalityTagsSelector';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/user.service';
import { storageService } from '@/services/storage.service';
import { UserIntention } from '@/lib/database.types';
import { LinearGradient } from 'expo-linear-gradient';

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
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <IconSymbol name="chevron.left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
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
              <View style={styles.cameraOverlay}>
                <IconSymbol name="camera.fill" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleImagePick} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoText}>Changer la photo</Text>
            </TouchableOpacity>
          </View>

          {/* FULL NAME */}
          <View style={styles.glassCard}>
            <Text style={styles.label}>Nom complet</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="person.fill" size={20} color="rgba(255,255,255,0.7)" />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          {/* BIO */}
          <View style={styles.glassCard}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.inputContainer, styles.textArea]}
              placeholder="Parlez-nous de vous..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* CITY */}
          <View style={styles.glassCard}>
            <Text style={styles.label}>Ville</Text>
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

          {/* PHONE */}
          <View style={styles.glassCard}>
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

          {/* INTENTION */}
          <View style={styles.glassCard}>
            <Text style={styles.label}>Je recherche sur RealMeet</Text>
            <IntentionSelector
              selectedIntention={intention}
              onIntentionChange={setIntention}
            />
          </View>

          {/* PERSONALITY TAGS */}
          <View style={styles.glassCard}>
            <Text style={styles.label}>Personnalité</Text>
            <PersonalityTagsSelector
              selectedTags={personalityTags}
              onTagsChange={setPersonalityTags}
              maxSelection={5}
            />
          </View>

          {/* INTERESTS */}
          <View style={styles.glassCard}>
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
              <ActivityIndicator color="#818CF8" />
            ) : (
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            )}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
    gap: 16,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  changePhotoButton: {
    marginTop: 12,
  },
  changePhotoText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Glass Card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
    textAlignVertical: 'top',
  },

  // Save button
  saveButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#818CF8',
  },
});
