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
  ActivityIndicator,   // ✅ Import ajouté
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/user.service';
import { storageService } from '@/services/storage.service';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [name, setName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [city, setCity] = useState(profile?.city || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [interests, setInterests] = useState<string[]>(profile?.interests || []);
  const [newInterest, setNewInterest] = useState('');
  const [profileImage, setProfileImage] = useState(profile?.avatar_url || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user || !profile) return;

    setLoading(true);

    try {
      let avatarUrl = profile.avatar_url;

      // Upload nouvelle image
      if (profileImage && profileImage !== profile.avatar_url) {
        const uploadResult = await storageService.uploadAvatar(profileImage, user.id);
        if (uploadResult.success) avatarUrl = uploadResult.url;
      }

      // Mise à jour du profil
      const result = await userService.updateProfile(user.id, {
        full_name: name,
        bio: bio || null,
        city: city || null,
        phone: phone || null,
        interests: interests.length > 0 ? interests : null,
        avatar_url: avatarUrl,
      });

      if (result.success) {
        await refreshProfile();
        Alert.alert('Succès', 'Profil mis à jour !');

        // ⛔ FIX navigation : timeout obligatoire pour Expo Router
        setTimeout(() => {
          router.back();
        }, 150);

      } else {
        Alert.alert('Erreur', result.error);
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
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

  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <Image
            source={{ uri: profileImage || 'https://via.placeholder.com/120' }}
            style={styles.avatar}
          />
          <TouchableOpacity style={styles.changePhotoButton} onPress={handleImagePick}>
            <IconSymbol name="camera.fill" size={20} color={colors.primary} />
            <Text style={styles.changePhotoText}>Changer la photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {/* NAME */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* BIO */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about yourself"
              placeholderTextColor={colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* CITY */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              placeholder="Your city"
              placeholderTextColor={colors.textSecondary}
              value={city}
              onChangeText={setCity}
            />
          </View>

          {/* PHONE */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="+33 6 12 34 56 78"
              placeholderTextColor={colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* INTERESTS */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Centres d'intérêt</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputInside}
                placeholder="Ajouter un intérêt"
                placeholderTextColor={colors.textSecondary}
                value={newInterest}
                onChangeText={setNewInterest}
                onSubmitEditing={handleAddInterest}
              />

              <TouchableOpacity onPress={handleAddInterest}>
                <IconSymbol name="plus.circle.fill" size={28} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.interestsContainer}>
              {interests.map((interest, index) => (
                <View key={index} style={styles.interestBadge}>
                  <Text style={styles.interestText}>{interest}</Text>
                  <TouchableOpacity onPress={() => handleRemoveInterest(index)}>
                    <IconSymbol name="xmark" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
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
    borderWidth: 4,
    borderColor: colors.primary,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changePhotoText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
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

  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },

  inputInside: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
  },

  textArea: {
    height: 120,
    textAlignVertical: 'top',
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

  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
