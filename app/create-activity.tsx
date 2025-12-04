// app/create-activity.tsx
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

export default function CreateActivityScreen() {
  const router = useRouter();

  // États du formulaire
  const [nom, setNom] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [categorie2, setCategorie2] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [prix, setPrix] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  // États pour le système de catégories
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectingCategory, setSelectingCategory] = useState<1 | 2>(1);

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

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
        setImageUrl(''); // Reset URL si upload
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  // Géocodage automatique
  const handleGeocode = async () => {
    if (!adresse.trim() || !ville.trim()) {
      Alert.alert('Erreur', 'Adresse et ville requises pour le géocodage');
      return;
    }

    setGeocoding(true);
    try {
      const fullAddress = `${adresse}, ${ville}${codePostal ? ', ' + codePostal : ''}, France`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setLatitude(lat);
        setLongitude(lon);
        Alert.alert('Succès', 'Coordonnées trouvées automatiquement !');
      } else {
        Alert.alert(
          'Aucun résultat',
          'Impossible de trouver les coordonnées. Vérifiez l\'adresse ou entrez-les manuellement.'
        );
      }
    } catch (error) {
      console.error('Erreur géocodage:', error);
      Alert.alert('Erreur', 'Erreur lors de la recherche des coordonnées');
    } finally {
      setGeocoding(false);
    }
  };

  // Création de l'activité
  const handleCreate = async () => {
    // Validation des champs obligatoires
    if (!nom.trim() || !description.trim() || !categorie.trim()) {
      Alert.alert('Erreur', 'Nom, description et catégorie principale sont requis');
      return;
    }

    if (!date.trim() || !timeStart.trim()) {
      Alert.alert('Erreur', 'Date et heure de début sont requises');
      return;
    }

    if (!adresse.trim() || !ville.trim()) {
      Alert.alert('Erreur', 'Adresse et ville sont requises');
      return;
    }

    if (!maxParticipants || parseInt(maxParticipants) <= 0) {
      Alert.alert('Erreur', 'Nombre de participants invalide');
      return;
    }

    if (!latitude || !longitude) {
      Alert.alert('Erreur', 'Coordonnées géographiques requises. Utilisez le bouton de géocodage.');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload de l'image si sélectionnée
      if (imageUri) {
        setUploadingImage(true);
        const uploadResult = await storageService.uploadActivityImage(imageUri);
        setUploadingImage(false);

        if (uploadResult.success && uploadResult.url) {
          setUploadedImageUrl(uploadResult.url);
        } else {
          Alert.alert(
            'Avertissement',
            'Erreur upload image. L\'activité sera créée avec une image par défaut.',
            [{ text: 'Continuer' }]
          );
        }
        setUploadingImage(false);
      }

      // 2. Créer l'activité
      const result = await activityService.createActivity({
        nom: nom.trim(),
        titre: titre.trim() || undefined,
        description: description.trim(),
        categorie: categorie.trim(),
        categorie2: categorie2.trim() || undefined,
        date: date.trim(),
        time_start: timeStart.trim(),
        time_end: timeEnd.trim() || undefined,
        adresse: adresse.trim(),
        ville: ville.trim(),
        code_postal: codePostal.trim() || undefined,
        max_participants: parseInt(maxParticipants),
        image_url: uploadedImageUrl || imageUrl.trim() || undefined,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        prix: prix.trim() ? parseFloat(prix) : undefined,
      });

      if (result.success) {
        Alert.alert(
          'Succès',
          'Activité créée avec succès !',
          [
            {
              text: 'OK',
              onPress: () => {
                router.back();
              },
            },
          ]
        );
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

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="xmark" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Créer une activité</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
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

          {/* Catégories (maximum 2) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Catégories * (maximum 2)</Text>
            
            {/* Catégorie 1 */}
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

            {/* Catégorie 2 (optionnelle) */}
            {categorie && (
              <TouchableOpacity
                style={[styles.input, styles.categoryButton, { marginTop: 10 }]}
                onPress={() => {
                  setSelectingCategory(2);
                  setShowCategoryPicker(true);
                }}
              >
                <Text style={categorie2 ? styles.categoryText : styles.placeholderText}>
                  {categorie2 || 'Ajouter une catégorie secondaire (optionnel)'}
                </Text>
                {categorie2 ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setCategorie2('');
                    }}
                    style={styles.clearButton}
                  >
                    <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : (
                  <IconSymbol name="chevron.down" size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            )}

            {/* Affichage des catégories sélectionnées */}
            {(categorie || categorie2) && (
              <View style={styles.selectedCategoriesContainer}>
                {categorie && (
                  <View style={[styles.categoryChip, { backgroundColor: getCategoryColor(categorie) + '20' }]}>
                    <Text style={[styles.categoryChipText, { color: getCategoryColor(categorie) }]}>
                      {categorie}
                    </Text>
                  </View>
                )}
                {categorie2 && (
                  <View style={[styles.categoryChip, { backgroundColor: getCategoryColor(categorie2) + '20' }]}>
                    <Text style={[styles.categoryChipText, { color: getCategoryColor(categorie2) }]}>
                      {categorie2}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Date et Heures */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD (ex: 2024-12-25)"
              placeholderTextColor={colors.textSecondary}
              value={date}
              onChangeText={setDate}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Heure début *</Text>
              <TextInput
                style={styles.input}
                placeholder="HH:MM (ex: 14:30)"
                placeholderTextColor={colors.textSecondary}
                value={timeStart}
                onChangeText={setTimeStart}
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Heure fin (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="HH:MM (ex: 18:00)"
                placeholderTextColor={colors.textSecondary}
                value={timeEnd}
                onChangeText={setTimeEnd}
              />
            </View>
          </View>

          {/* Adresse */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adresse *</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: 5 Avenue des Champs-Élysées"
              placeholderTextColor={colors.textSecondary}
              value={adresse}
              onChangeText={setAdresse}
            />
          </View>

          {/* Ville et Code postal */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex2]}>
              <Text style={styles.label}>Ville *</Text>
              <TextInput
                style={styles.input}
                placeholder="ex: Paris"
                placeholderTextColor={colors.textSecondary}
                value={ville}
                onChangeText={setVille}
              />
            </View>

            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>Code postal</Text>
              <TextInput
                style={styles.input}
                placeholder="75008"
                placeholderTextColor={colors.textSecondary}
                value={codePostal}
                onChangeText={setCodePostal}
                keyboardType="number-pad"
              />
            </View>
          </View>

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

          {/* Séparateur */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Localisation GPS</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Bouton de géocodage */}
          <TouchableOpacity
            style={[
              styles.geocodeButton,
              (!adresse.trim() || !ville.trim() || geocoding) && styles.geocodeButtonDisabled,
            ]}
            onPress={handleGeocode}
            disabled={!adresse.trim() || !ville.trim() || geocoding}
          >
            {geocoding ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol name="location.fill" size={24} color={colors.primary} />
            )}
            <Text style={styles.geocodeButtonText}>
              {geocoding ? 'Recherche en cours...' : 'Trouver les coordonnées automatiquement'}
            </Text>
          </TouchableOpacity>

          {/* Coordonnées GPS */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Latitude *</Text>
              <TextInput
                style={[styles.input, latitude && styles.inputDisabled]}
                placeholder="48.8566"
                placeholderTextColor={colors.textSecondary}
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="decimal-pad"
                editable={!latitude}
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Longitude *</Text>
              <TextInput
                style={[styles.input, longitude && styles.inputDisabled]}
                placeholder="2.3522"
                placeholderTextColor={colors.textSecondary}
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="decimal-pad"
                editable={!longitude}
              />
            </View>
          </View>

          <Text style={styles.helperText}>
            💡 Utilisez le bouton ci-dessus pour obtenir automatiquement les coordonnées.
            Vous pouvez aussi les modifier manuellement si besoin.
          </Text>

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
              <Text style={styles.helperText}>
                Vous pouvez soit uploader une image ci-dessus, soit entrer une URL ici
              </Text>
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
                {uploadingImage ? 'Upload de l\'image...' : 'Création...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.createButtonText}>Créer l'activité</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          * Les champs marqués d'un astérisque sont obligatoires
        </Text>
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

            <ScrollView style={styles.categoryList}>
              {PREDEFINED_CATEGORIES
                .filter(cat => {
                  // Ne pas afficher la catégorie déjà sélectionnée
                  if (selectingCategory === 1) {
                    return cat.name !== categorie2;
                  } else {
                    return cat.name !== categorie;
                  }
                })
                .map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.categoryOption}
                    onPress={() => {
                      if (selectingCategory === 1) {
                        setCategorie(category.name);
                      } else {
                        setCategorie2(category.name);
                      }
                      setShowCategoryPicker(false);
                    }}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                      <IconSymbol name={category.icon} size={24} color={category.color} />
                    </View>
                    <Text style={styles.categoryOptionText}>{category.name}</Text>
                  </TouchableOpacity>
                ))}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    paddingRight: 15,
  },
  categoryText: {
    color: colors.text,
    fontSize: 16,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  selectedCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  geocodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  geocodeButtonDisabled: {
    opacity: 0.5,
  },
  geocodeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: colors.border + '20',
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  categoryList: {
    padding: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  categoryOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
});