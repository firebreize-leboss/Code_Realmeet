// app/create-activity.tsx
// Version mise à jour avec autocomplétion d'adresse et sélection par calendrier

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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { activityService } from '@/services/activity.service';
import { storageService } from '@/services/storage.service';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import ActivityCalendar from '@/components/ActivityCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function CreateActivityScreen() {
  const router = useRouter();

  // États du formulaire
  const [nom, setNom] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [categorie2, setCategorie2] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [prix, setPrix] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  // États pour l'adresse (autocomplétion)
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [addressSelected, setAddressSelected] = useState(false);

  // États pour le système de catégories
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectingCategory, setSelectingCategory] = useState<1 | 2>(1);

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [pendingSlots, setPendingSlots] = useState<{date: string; time: string; duration: number}[]>([]);
  const { profile } = useAuth();
  const isBusiness = profile?.account_type === 'business';

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
        setImageUrl('');
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


  // Création de l'activité
  const handleCreate = async () => {
    // Validation des champs obligatoires
    if (!nom.trim() || !description.trim() || !categorie.trim()) {
      Alert.alert('Erreur', 'Nom, description et catégorie principale sont requis');
      return;
    }

    // Entreprise : vérifier qu'il y a au moins un créneau
    if (isBusiness && pendingSlots.length === 0) {
      Alert.alert('Erreur', 'Veuillez ajouter au moins un créneau dans le calendrier');
      return;
    }

    if (!addressSelected || !latitude || !longitude) {
      Alert.alert('Erreur', 'Veuillez sélectionner une adresse dans la liste');
      return;
    }

    // Validation du nombre de participants (seulement pour les non-business)
    if (!isBusiness && (!maxParticipants || parseInt(maxParticipants) <= 0)) {
      Alert.alert('Erreur', 'Nombre de participants invalide');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload de l'image si sélectionnée
      let finalImageUrl: string | undefined = imageUrl.trim() || undefined;

      if (imageUri) {
        setUploadingImage(true);
        const uploadResult = await storageService.uploadActivityImage(imageUri);
        setUploadingImage(false);

        if (uploadResult.success && uploadResult.url) {
          finalImageUrl = uploadResult.url;
        } else {
          Alert.alert(
            'Avertissement',
            'Erreur upload image. L\'activité sera créée avec une image par défaut.',
            [{ text: 'Continuer' }]
          );
        }
      }

      // 2. Créer l'activité
      // Pour les entreprises, utiliser le premier créneau. Pour les autres, utiliser la date du jour
      const firstSlot = isBusiness && pendingSlots.length > 0
        ? pendingSlots.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0]
        : null;

      const today = new Date();
      const defaultDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

      const result = await activityService.createActivity({
        nom: nom.trim(),
        titre: titre.trim() || undefined,
        description: description.trim(),
        categorie: categorie.trim(),
        categorie2: categorie2.trim() || undefined,
        date: firstSlot ? firstSlot.date : defaultDate,
        time_start: firstSlot ? firstSlot.time : '09:00',
        time_end: undefined, // Géré par les créneaux
        adresse: adresse.trim(),
        ville: ville.trim(),
        code_postal: codePostal.trim() || undefined,
        max_participants: isBusiness
          ? pendingSlots.reduce((sum, s) => sum + (s.max_participants || 10), 0)
          : parseInt(maxParticipants),
        image_url: finalImageUrl,
        latitude: latitude,
        longitude: longitude,
        prix: prix.trim() ? parseFloat(prix) : undefined,
        status: isBusiness ? 'draft' : 'active',
      });

      if (result.success) {
  // 3. Créer les créneaux si c'est une entreprise
  if (isBusiness && pendingSlots.length > 0 && result.data?.id) {
    const slotsToInsert = pendingSlots.map(slot => ({
      activity_id: result.data.id,
      date: slot.date,
      time: slot.time,
      duration: slot.duration,
      max_participants: slot.max_participants || 10,
      max_groups: slot.max_groups || 2,
      participants_per_group: slot.participants_per_group || 5,
      min_participants_per_group: slot.min_participants_per_group || 4,
      created_by: result.data.host_id,
    }));

    const { error: slotsError } = await supabase
      .from('activity_slots')
      .insert(slotsToInsert);

    if (slotsError) {
      console.error('Erreur création créneaux:', slotsError);
    }
  }

  Alert.alert('Succès', 'Activité créée avec succès !', [
    { text: 'OK', onPress: () => router.back() },
  ]);
} else {
        Alert.alert('Erreur', result.error || 'Erreur lors de la création');
      }
    } catch (error: any) {
      console.error('Erreur création:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
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

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="xmark" size={24} color={colors.text} />
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
          ) : (
            <View style={styles.uploadPlaceholder}>
              <IconSymbol name="photo" size={48} color={colors.textSecondary} />
              <Text style={styles.uploadText}>Ajouter une photo</Text>
              <Text style={styles.uploadSubtext}>Appuyez pour sélectionner</Text>
            </View>
          )}
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
              <Text style={categorie ? styles.categoryText : styles.placeholderText}>
                {categorie || 'Sélectionner la catégorie principale'}
              </Text>
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
                <Text style={categorie2 ? styles.categoryText : styles.placeholderText}>
                  {categorie2 || 'Ajouter une 2ème catégorie (optionnel)'}
                </Text>
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

          {/* Affichage ville et code postal (lecture seule après sélection) */}
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
            {isBusiness ? (
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Places totales</Text>
                <View style={[styles.input, { justifyContent: 'center' }]}>
                  <Text style={{ color: pendingSlots.length > 0 ? colors.text : colors.textSecondary }}>
                    {pendingSlots.length > 0 
                      ? pendingSlots.reduce((sum, s) => sum + (s.max_participants || 10), 0)
                      : 'Ajoutez des créneaux'}
                  </Text>
                </View>
              </View>
            ) : (
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
            )}

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
          
          {/* Créneaux horaires - Uniquement pour les entreprises */}
          {isBusiness && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Créneaux disponibles</Text>
              <Text style={styles.helperText}>
                Ajoutez les créneaux horaires pour cette activité
              </Text>
              <View style={{ marginTop: 12 }}>
                <ActivityCalendar
                  mode="edit"
                  pendingSlots={pendingSlots}
                  onSlotsChange={setPendingSlots}
                />
              </View>
            </View>
          )}


          {/* URL image manuelle (optionnel si pas d'upload) */}
          {!imageUri && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ou entrez une URL d'image (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://exemple.com/image.jpg"
                placeholderTextColor={colors.textSecondary}
                value={imageUrl}
                onChangeText={setImageUrl}
              />
            </View>
          )}
        </View>

        {/* Bouton de création */}
        <TouchableOpacity
          style={[styles.createButton, (loading || uploadingImage) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading || uploadingImage}
        >
          {loading || uploadingImage ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.background} />
              <Text style={styles.createButtonText}>
                {uploadingImage ? 'Upload image...' : 'Création...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.createButtonText}>Créer l'activité</Text>
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

            <ScrollView style={styles.categoriesList}>
              {PREDEFINED_CATEGORIES.map((cat) => {
                const isDisabled = selectingCategory === 2 && cat.name === categorie;
                const isSelected = selectingCategory === 1 
                  ? cat.name === categorie 
                  : cat.name === categorie2;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryItem,
                      isSelected && { backgroundColor: cat.color + '20' },
                      isDisabled && styles.categoryItemDisabled,
                    ]}
                    onPress={() => !isDisabled && handleCategorySelect(cat.name)}
                    disabled={isDisabled}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                      <IconSymbol name={cat.icon as any} size={24} color={cat.color} />
                    </View>
                    <Text style={[
                      styles.categoryItemText,
                      isDisabled && styles.categoryItemTextDisabled,
                    ]}>
                      {cat.name}
                    </Text>
                    {isSelected && (
                      <IconSymbol name="checkmark.circle.fill" size={24} color={cat.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  imageUploadZone: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: colors.card,
    marginTop: 20,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  uploadSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
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
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginVertical: 10,
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
    letterSpacing: 0.5,
  },
  addressDetails: {
    backgroundColor: colors.primary + '10',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  addressDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressDetailText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.background,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  categoriesList: {
    padding: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 14,
  },
  categoryItemDisabled: {
    opacity: 0.4,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  helperText: {
  fontSize: 13,
  color: colors.textSecondary,
  marginTop: 4,
  },
  categoryItemTextDisabled: {
    color: colors.textSecondary,
  },
});