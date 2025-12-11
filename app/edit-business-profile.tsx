// app/edit-business-profile.tsx
// Page d'édition du profil entreprise

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';

const DAYS_OF_WEEK = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi', label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
];

interface BusinessHours {
  [key: string]: { open: string; close: string; closed?: boolean };
}

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
}

export default function EditBusinessProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessSiret, setBusinessSiret] = useState('');
  const [businessLogoUrl, setBusinessLogoUrl] = useState('');
  const [businessCoverUrl, setBusinessCoverUrl] = useState('');
  const [businessHours, setBusinessHours] = useState<BusinessHours>({});
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});

  // Category picker state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/account-type');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Populate form with existing data
      setBusinessName(data.business_name || '');
      setBusinessDescription(data.business_description || '');
      setBusinessCategory(data.business_category || '');
      setBusinessWebsite(data.business_website || '');
      setBusinessPhone(data.business_phone || '');
      setBusinessEmail(data.business_email || '');
      setBusinessAddress(data.business_address || '');
      setBusinessSiret(data.business_siret || '');
      setBusinessLogoUrl(data.business_logo_url || data.avatar_url || '');
      setBusinessCoverUrl(data.business_cover_url || '');
      setBusinessHours(data.business_hours || {});
      setSocialLinks(data.business_social_links || {});
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (type: 'logo' | 'cover') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Accès à la galerie nécessaire');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        if (type === 'logo') {
          setUploadingLogo(true);
        } else {
          setUploadingCover(true);
        }

        try {
          // Récupérer l'utilisateur
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Non connecté');

          // Lire l'image en base64
          const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Générer un nom de fichier unique
          const fileExt = result.assets[0].uri.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${user.id}-${type}-${Date.now()}.${fileExt}`;
          const bucketName = type === 'logo' ? 'avatars' : 'activity-images';
          const filePath = `${user.id}/${fileName}`;

          // Upload vers Supabase
          const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, decode(base64), {
              contentType: `image/${fileExt}`,
              upsert: true,
            });

          if (error) throw error;

          // Récupérer l'URL publique
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(data.path);

          if (type === 'logo') {
            setBusinessLogoUrl(urlData.publicUrl);
          } else {
            setBusinessCoverUrl(urlData.publicUrl);
          }

          console.log('✅ Image uploadée:', urlData.publicUrl);
        } catch (uploadError: any) {
          console.error('Erreur upload:', uploadError);
          Alert.alert('Erreur', uploadError.message || "Impossible d'uploader l'image");
        }

        if (type === 'logo') {
          setUploadingLogo(false);
        } else {
          setUploadingCover(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erreur', "Impossible de charger l'image");
      setUploadingLogo(false);
      setUploadingCover(false);
    }
  };

  const updateHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
        open: prev[day]?.open || '09:00',
        close: prev[day]?.close || '18:00',
      },
    }));
  };

  const handleSave = async () => {
    if (!businessName.trim()) {
      Alert.alert('Erreur', 'Le nom de l\'entreprise est requis');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { error } = await supabase
        .from('profiles')
        .update({
          business_name: businessName.trim(),
          business_description: businessDescription.trim(),
          business_category: businessCategory,
          business_website: businessWebsite.trim(),
          business_phone: businessPhone.trim(),
          business_email: businessEmail.trim(),
          business_address: businessAddress.trim(),
          business_siret: businessSiret.trim(),
          business_logo_url: businessLogoUrl,
          business_cover_url: businessCoverUrl,
          business_hours: businessHours,
          business_social_links: socialLinks,
          // Also update avatar_url with logo for consistency
          avatar_url: businessLogoUrl || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Succès', 'Profil mis à jour !', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier le profil</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cover Image */}
          <TouchableOpacity
            style={styles.coverContainer}
            onPress={() => pickImage('cover')}
            disabled={uploadingCover}
          >
            {businessCoverUrl ? (
              <Image source={{ uri: businessCoverUrl }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <IconSymbol name="photo.fill" size={32} color={colors.textSecondary} />
                <Text style={styles.coverPlaceholderText}>Ajouter une photo de couverture</Text>
              </View>
            )}
            {uploadingCover && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={colors.background} />
              </View>
            )}
            <View style={styles.editCoverBadge}>
              <IconSymbol name="camera.fill" size={16} color={colors.background} />
            </View>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoSection}>
            <TouchableOpacity
              style={styles.logoContainer}
              onPress={() => pickImage('logo')}
              disabled={uploadingLogo}
            >
              {businessLogoUrl ? (
                <Image source={{ uri: businessLogoUrl }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <IconSymbol name="building.2.fill" size={32} color={colors.textSecondary} />
                </View>
              )}
              {uploadingLogo && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color={colors.background} />
                </View>
              )}
              <View style={styles.editLogoBadge}>
                <IconSymbol name="camera.fill" size={12} color={colors.background} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Basic Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations générales</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom de l'entreprise *</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Nom de votre entreprise"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Catégorie</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={businessCategory ? styles.selectText : styles.selectPlaceholder}>
                  {businessCategory || 'Sélectionner une catégorie'}
                </Text>
                <IconSymbol name="chevron.down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={businessDescription}
                onChangeText={setBusinessDescription}
                placeholder="Décrivez votre entreprise et vos services..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Numéro SIRET (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={businessSiret}
                onChangeText={setBusinessSiret}
                placeholder="123 456 789 01234"
                placeholderTextColor={colors.textSecondary}
                keyboardType="default"
                maxLength={20}
              />
            </View>
          </View>

          {/* Contact Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Adresse</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={businessAddress}
                onChangeText={setBusinessAddress}
                placeholder="Adresse complète"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={businessPhone}
                onChangeText={setBusinessPhone}
                placeholder="+33 X XX XX XX XX"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email professionnel</Text>
              <TextInput
                style={styles.input}
                value={businessEmail}
                onChangeText={setBusinessEmail}
                placeholder="contact@entreprise.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Site web</Text>
              <TextInput
                style={styles.input}
                value={businessWebsite}
                onChangeText={setBusinessWebsite}
                placeholder="https://www.votresite.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Business Hours Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Horaires d'ouverture</Text>
            <View style={styles.hoursContainer}>
              {DAYS_OF_WEEK.map(day => (
                <View key={day.key} style={styles.dayRow}>
                  <TouchableOpacity
                    style={styles.dayToggle}
                    onPress={() => updateHours(day.key, 'closed', !businessHours[day.key]?.closed)}
                  >
                    <View style={[
                      styles.checkbox,
                      !businessHours[day.key]?.closed && styles.checkboxChecked
                    ]}>
                      {!businessHours[day.key]?.closed && (
                        <IconSymbol name="checkmark" size={14} color={colors.background} />
                      )}
                    </View>
                    <Text style={[
                      styles.dayLabel,
                      businessHours[day.key]?.closed && styles.dayLabelClosed
                    ]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                  {!businessHours[day.key]?.closed && (
                    <View style={styles.hoursInputs}>
                      <TextInput
                        style={styles.timeInput}
                        value={businessHours[day.key]?.open || '09:00'}
                        onChangeText={(v) => updateHours(day.key, 'open', v)}
                        placeholder="09:00"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <Text style={styles.timeSeparator}>-</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={businessHours[day.key]?.close || '18:00'}
                        onChangeText={(v) => updateHours(day.key, 'close', v)}
                        placeholder="18:00"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  )}
                  {businessHours[day.key]?.closed && (
                    <Text style={styles.closedText}>Fermé</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Social Links Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Réseaux sociaux</Text>

            <View style={styles.socialInputGroup}>
              <View style={[styles.socialIcon, { backgroundColor: '#E4405F20' }]}>
                <IconSymbol name="camera.fill" size={20} color="#E4405F" />
              </View>
              <TextInput
                style={styles.socialInput}
                value={socialLinks.instagram || ''}
                onChangeText={(v) => setSocialLinks(prev => ({ ...prev, instagram: v }))}
                placeholder="@votrecompte"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.socialInputGroup}>
              <View style={[styles.socialIcon, { backgroundColor: '#1877F220' }]}>
                <IconSymbol name="person.2.fill" size={20} color="#1877F2" />
              </View>
              <TextInput
                style={styles.socialInput}
                value={socialLinks.facebook || ''}
                onChangeText={(v) => setSocialLinks(prev => ({ ...prev, facebook: v }))}
                placeholder="URL de votre page Facebook"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.socialInputGroup}>
              <View style={[styles.socialIcon, { backgroundColor: '#1DA1F220' }]}>
                <IconSymbol name="message.fill" size={20} color="#1DA1F2" />
              </View>
              <TextInput
                style={styles.socialInput}
                value={socialLinks.twitter || ''}
                onChangeText={(v) => setSocialLinks(prev => ({ ...prev, twitter: v }))}
                placeholder="@votrecompte"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.socialInputGroup}>
              <View style={[styles.socialIcon, { backgroundColor: '#0A66C220' }]}>
                <IconSymbol name="briefcase.fill" size={20} color="#0A66C2" />
              </View>
              <TextInput
                style={styles.socialInput}
                value={socialLinks.linkedin || ''}
                onChangeText={(v) => setSocialLinks(prev => ({ ...prev, linkedin: v }))}
                placeholder="URL de votre profil LinkedIn"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.mainSaveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.mainSaveButtonText}>Enregistrer les modifications</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Category Picker Modal */}
        {showCategoryPicker && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Catégorie</Text>
                <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                  <IconSymbol name="xmark" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      businessCategory === cat.name && styles.categoryOptionSelected
                    ]}
                    onPress={() => {
                      setBusinessCategory(cat.name);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <View style={styles.categoryOptionContent}>
                      <View style={[styles.categoryIconSmall, { backgroundColor: cat.color + '20' }]}>
                        <IconSymbol name={cat.icon} size={20} color={cat.color} />
                      </View>
                      <Text style={[
                        styles.categoryOptionText,
                        businessCategory === cat.name && styles.categoryOptionTextSelected
                      ]}>
                        {cat.name}
                      </Text>
                    </View>
                    {businessCategory === cat.name && (
                      <IconSymbol name="checkmark" size={20} color={colors.primary} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  coverContainer: {
    width: '100%',
    height: 150,
    backgroundColor: colors.card,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  coverPlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCoverBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: -50,
    marginBottom: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 4,
    borderColor: colors.background,
    overflow: 'hidden',
    position: 'relative',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editLogoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  selectInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectText: {
    fontSize: 16,
    color: colors.text,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  hoursContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  dayLabelClosed: {
    color: colors.textSecondary,
  },
  hoursInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    width: 70,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  closedText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  socialInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  socialIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mainSaveButton: {
    backgroundColor: colors.primary,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  mainSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
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
    backgroundColor: colors.primary + '10',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  categoryOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});