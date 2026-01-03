// app/edit-activity.tsx
// Page de modification d'une activité existante

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
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { storageService } from '@/services/storage.service';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { DateTimeRangePicker } from '@/components/DateTimePicker';
import ActivityCalendar from '@/components/ActivityCalendar';

export default function EditActivityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const activityId = id as string;

  // État de chargement initial
  const [loadingActivity, setLoadingActivity] = useState(true);

  // États du formulaire
  const [nom, setNom] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [categorie2, setCategorie2] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [prix, setPrix] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  // États pour l'adresse
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [addressSelected, setAddressSelected] = useState(false);

  // États pour la date/heure
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeStart, setTimeStart] = useState<Date | null>(null);
  const [timeEnd, setTimeEnd] = useState<Date | null>(null);

  // États pour le système de catégories
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectingCategory, setSelectingCategory] = useState<1 | 2>(1);

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Charger les données de l'activité au montage
  useEffect(() => {
    if (activityId) {
      loadActivity();
    }
  }, [activityId]);

  const loadActivity = async () => {
    try {
      setLoadingActivity(true);

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Activité introuvable');

      // Remplir les champs avec les données existantes
      setNom(data.nom || '');
      setTitre(data.titre || '');
      setDescription(data.description || '');
      setCategorie(data.categorie || '');
      setCategorie2(data.categorie2 || '');
      setMaxParticipants(data.max_participants?.toString() || '');
      setPrix(data.prix?.toString() || '');
      setCurrentImageUrl(data.image_url || '');
      setAdresse(data.adresse || '');
      setVille(data.ville || '');
      setCodePostal(data.code_postal || '');
      setLatitude(data.latitude || null);
      setLongitude(data.longitude || null);
      setAddressSelected(!!(data.latitude && data.longitude));

      // Parser la date
      if (data.date) {
        setSelectedDate(new Date(data.date));
      }

      // Parser l'heure de début
      if (data.time_start) {
        const [hours, minutes] = data.time_start.split(':');
        const timeStartDate = new Date();
        timeStartDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        setTimeStart(timeStartDate);
      }

      // Parser l'heure de fin
      if (data.time_end) {
        const [hours, minutes] = data.time_end.split(':');
        const timeEndDate = new Date();
        timeEndDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        setTimeEnd(timeEndDate);
      }
    } catch (error: any) {
      console.error('Erreur chargement activité:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'activité', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Fonction pour obtenir la couleur d'une catégorie
  const getCategoryColor = (categoryName: string): string => {
    const category = PREDEFINED_CATEGORIES.find(cat => cat.name === categoryName);
    return category?.color || colors.primary;
  };

  // Sélection d'image
  const handleImageSelection = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Accès à la galerie nécessaire');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  // Gestion de l'adresse sélectionnée
  const handleAddressSelect = (result: {
    address: string;
    city: string;
    postcode: string;
    latitude: number;
    longitude: number;
  }) => {
    setAdresse(result.address);
    setVille(result.city);
    setCodePostal(result.postcode);
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setAddressSelected(true);
  };

  // Formatage de la date pour l'API
  const formatDateForAPI = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Formatage de l'heure pour l'API
  const formatTimeForAPI = (time: Date): string => {
    return time.toTimeString().slice(0, 5);
  };

  // Sélection de catégorie
  const handleCategorySelect = (categoryName: string) => {
    if (selectingCategory === 1) {
      setCategorie(categoryName);
      if (categorie2 === categoryName) setCategorie2('');
    } else {
      if (categoryName !== categorie) {
        setCategorie2(categoryName);
      }
    }
    setShowCategoryPicker(false);
  };

  // Sauvegarde des modifications
  const handleSave = async () => {
    // Validation
    if (!nom.trim() || !description.trim() || !categorie.trim()) {
      Alert.alert('Erreur', 'Nom, description et catégorie principale sont requis');
      return;
    }

    if (!selectedDate || !timeStart) {
      Alert.alert('Erreur', 'Date et heure de début sont requises');
      return;
    }

    if (!addressSelected || !latitude || !longitude) {
      Alert.alert('Erreur', 'Veuillez sélectionner une adresse valide');
      return;
    }

    if (!maxParticipants || parseInt(maxParticipants) <= 0) {
      Alert.alert('Erreur', 'Nombre de participants invalide');
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = currentImageUrl;

      // Upload nouvelle image si sélectionnée
      if (imageUri) {
        setUploadingImage(true);
        const uploadResult = await storageService.uploadActivityImage(imageUri);
        setUploadingImage(false);

        if (uploadResult.success && uploadResult.url) {
          finalImageUrl = uploadResult.url;
        } else {
          Alert.alert('Avertissement', 'Erreur upload image. L\'ancienne image sera conservée.');
        }
      }

      // Mise à jour de l'activité
      const { error } = await supabase
        .from('activities')
        .update({
          nom: nom.trim(),
          titre: titre.trim() || null,
          description: description.trim(),
          categorie: categorie.trim(),
          categorie2: categorie2.trim() || null,
          date: formatDateForAPI(selectedDate),
          time_start: formatTimeForAPI(timeStart),
          time_end: timeEnd ? formatTimeForAPI(timeEnd) : null,
          adresse: adresse.trim(),
          ville: ville.trim(),
          code_postal: codePostal.trim() || null,
          max_participants: parseInt(maxParticipants),
          image_url: finalImageUrl,
          latitude: latitude,
          longitude: longitude,
          prix: prix.trim() ? parseFloat(prix) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activityId);

      if (error) throw error;

      Alert.alert('Succès', 'Activité mise à jour !', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Erreur mise à jour:', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour l\'activité');
    } finally {
      setSaving(false);
    }
  };

  // Écran de chargement
  if (loadingActivity) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement de l'activité...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="xmark" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier l'activité</Text>
        <TouchableOpacity
          style={styles.saveHeaderButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveHeaderText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Zone d'upload d'image */}
        <TouchableOpacity
          style={styles.imageUploadZone}
          onPress={handleImageSelection}
          activeOpacity={0.7}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
          ) : currentImageUrl ? (
            <Image source={{ uri: currentImageUrl }} style={styles.uploadedImage} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <IconSymbol name="photo" size={48} color={colors.textSecondary} />
              <Text style={styles.uploadText}>Ajouter une photo</Text>
            </View>
          )}
          <View style={styles.editImageBadge}>
            <IconSymbol name="camera.fill" size={16} color={colors.background} />
          </View>
        </TouchableOpacity>

        <View style={styles.form}>
          {/* Nom de l'activité */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom de l'activité *</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Laser Quest Aventure"
              placeholderTextColor={colors.textSecondary}
              value={nom}
              onChangeText={setNom}
            />
          </View>

          {/* Titre (optionnel) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Titre accrocheur (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Soirée laser game + Karaoke"
              placeholderTextColor={colors.textSecondary}
              value={titre}
              onChangeText={setTitre}
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez votre activité en détail..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Catégories */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Catégories * (maximum 2)</Text>
            
            <TouchableOpacity
              style={[styles.input, styles.categoryButton]}
              onPress={() => {
                setSelectingCategory(1);
                setShowCategoryPicker(true);
              }}
            >
              {categorie ? (
                <View style={styles.selectedCategory}>
                  <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(categorie) }]} />
                  <Text style={styles.categoryText}>{categorie}</Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>Sélectionner la catégorie principale</Text>
              )}
              <IconSymbol name="chevron.down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {categorie && (
              <TouchableOpacity
                style={[styles.input, styles.categoryButton, { marginTop: 10 }]}
                onPress={() => {
                  setSelectingCategory(2);
                  setShowCategoryPicker(true);
                }}
              >
                {categorie2 ? (
                  <View style={styles.selectedCategory}>
                    <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(categorie2) }]} />
                    <Text style={styles.categoryText}>{categorie2}</Text>
                  </View>
                ) : (
                  <Text style={styles.placeholderText}>Ajouter une 2ème catégorie (optionnel)</Text>
                )}
                <IconSymbol name="chevron.down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Séparateur Date/Heure */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Date et horaire</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sélection Date et Heure */}
          <DateTimeRangePicker
            date={selectedDate}
            timeStart={timeStart}
            timeEnd={timeEnd}
            onDateChange={setSelectedDate}
            onTimeStartChange={setTimeStart}
            onTimeEndChange={setTimeEnd}
            showTimeEnd={true}
          />

          {/* Séparateur Adresse */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Localisation</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Autocomplétion d'adresse */}
          <AddressAutocomplete
            value={adresse}
            onAddressSelect={handleAddressSelect}
            placeholder="Rechercher une adresse..."
            label="Adresse *"
          />

          {/* Affichage ville et code postal */}
          {addressSelected && (
            <View style={styles.addressDetails}>
              <View style={styles.addressDetailRow}>
                <IconSymbol name="location.fill" size={16} color={colors.primary} />
                <Text style={styles.addressDetailText}>
                  {ville}{codePostal ? `, ${codePostal}` : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Participants et Prix */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Max participants *</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                placeholderTextColor={colors.textSecondary}
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                keyboardType="number-pad"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Prix (€, optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="15.00"
                placeholderTextColor={colors.textSecondary}
                value={prix}
                onChangeText={setPrix}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
        
        
        {/* Bouton de sauvegarde */}
        <TouchableOpacity
          style={[styles.saveButton, (saving || uploadingImage) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || uploadingImage}
        >
          {saving || uploadingImage ? (
            <View style={styles.savingContainer}>
              <ActivityIndicator color={colors.background} />
              <Text style={styles.saveButtonText}>
                {uploadingImage ? 'Upload image...' : 'Enregistrement...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de sélection de catégorie */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectingCategory === 1 ? 'Catégorie principale' : 'Catégorie secondaire'}
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <IconSymbol name="xmark" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {PREDEFINED_CATEGORIES.map((cat) => {
                const isSelected = selectingCategory === 1 
                  ? categorie === cat.name 
                  : categorie2 === cat.name;
                const isDisabled = selectingCategory === 2 && categorie === cat.name;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      isSelected && styles.categoryOptionSelected,
                      isDisabled && styles.categoryOptionDisabled,
                    ]}
                    onPress={() => !isDisabled && handleCategorySelect(cat.name)}
                    disabled={isDisabled}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                      <IconSymbol name={cat.icon} size={24} color={cat.color} />
                    </View>
                    <Text style={[
                      styles.categoryOptionText,
                      isSelected && styles.categoryOptionTextSelected,
                      isDisabled && styles.categoryOptionTextDisabled,
                    ]}>
                      {cat.name}
                    </Text>
                    {isSelected && (
                      <IconSymbol name="checkmark.circle.fill" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectingCategory === 2 && categorie2 && (
              <TouchableOpacity
                style={styles.removeCategoryButton}
                onPress={() => {
                  setCategorie2('');
                  setShowCategoryPicker(false);
                }}
              >
                <IconSymbol name="trash.fill" size={20} color="#EF4444" />
                <Text style={styles.removeCategoryText}>Supprimer la 2ème catégorie</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  saveHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveHeaderText: {
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
  imageUploadZone: {
    height: 200,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  uploadText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  editImageBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
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
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addressDetails: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  addressDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressDetailText: {
    fontSize: 14,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  helperText: {
  fontSize: 13,
  color: colors.textSecondary,
  marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
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
    padding: 16,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.card,
    gap: 12,
  },
  categoryOptionSelected: {
    backgroundColor: colors.primary + '15',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  categoryOptionDisabled: {
    opacity: 0.4,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  categoryOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  categoryOptionTextDisabled: {
    color: colors.textSecondary,
  },
  removeCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  removeCategoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});