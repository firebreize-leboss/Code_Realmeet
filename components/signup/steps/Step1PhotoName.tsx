// components/signup/steps/Step1PhotoName.tsx
// Étape 1: Photo de profil + Prénom/Nom

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { SignupInput } from '../SignupInput';
import { useSignup } from '@/contexts/SignupContext';
import { storageService } from '@/services/storage.service';
import { colors, spacing, typography, borderRadius } from '@/styles/commonStyles';

export function Step1PhotoName() {
  const { formData, updateFormData, getStepErrors } = useSignup();
  const errors = getStepErrors(1);

  const handleImagePick = async () => {
    const result = await storageService.pickImage();
    if (result.success && result.uri) {
      updateFormData('profileImage', result.uri);
    } else if (result.error && result.error !== 'Sélection annulée') {
      Alert.alert('Erreur', result.error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Titre et description */}
      <View style={styles.header}>
        <Text style={styles.title}>Faisons connaissance</Text>
        <Text style={styles.subtitle}>
          Ajoutez une photo et dites-nous comment vous vous appelez
        </Text>
      </View>

      {/* Avatar picker */}
      <View style={styles.photoSection}>
        <TouchableOpacity
          style={styles.photoContainer}
          onPress={handleImagePick}
          activeOpacity={0.8}
        >
          {formData.profileImage ? (
            <Image
              source={{ uri: formData.profileImage }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <IconSymbol name="camera.fill" size={32} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.cameraBadge}>
            <IconSymbol name="plus" size={16} color={colors.textOnPrimary} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleImagePick}>
          <Text style={styles.photoText}>
            {formData.profileImage ? 'Changer la photo' : 'Ajouter une photo'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.photoHint}>Optionnel — vous pourrez l'ajouter plus tard</Text>
      </View>

      {/* Champs nom */}
      <View style={styles.form}>
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <SignupInput
              label="Prénom"
              required
              placeholder="Jean"
              value={formData.firstName}
              onChangeText={(text) => updateFormData('firstName', text)}
              error={errors.firstName}
              autoCapitalize="words"
              autoComplete="given-name"
            />
          </View>
          <View style={styles.halfInput}>
            <SignupInput
              label="Nom"
              required
              placeholder="Dupont"
              value={formData.lastName}
              onChangeText={(text) => updateFormData('lastName', text)}
              error={errors.lastName}
              autoCapitalize="words"
              autoComplete="family-name"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: 26,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.borderLight,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.backgroundAlt,
  },
  photoText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  photoHint: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textMuted,
  },
  form: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
});
