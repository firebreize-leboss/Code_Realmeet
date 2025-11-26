import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { activityService } from '@/services/activity.service';
import { geocodingService } from '@/services/geocoding.service';
import { activityStorageService } from '@/services/activity-storage.service';
import { supabase } from '@/lib/supabase';

export default function CreateActivityScreen() {
  const router = useRouter();
  
  // États du formulaire
  const [nom, setNom] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUri, setImageUri] = useState(''); // URI locale de l'image
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [prix, setPrix] = useState('');
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Géocodage automatique quand adresse et ville sont remplis
  useEffect(() => {
    // Attendre que l'utilisateur ait fini de taper (debounce)
    const timer = setTimeout(() => {
      if (adresse.trim() && ville.trim() && !latitude && !longitude && !geocoding) {
        handleGeocodeAddress();
      }
    }, 1500); // Attendre 1.5s après la dernière frappe

    return () => clearTimeout(timer);
  }, [adresse, ville]);

  // Sélectionner une image depuis la galerie
  const handlePickImage = async () => {
    const result = await activityStorageService.pickImage();
    if (result.success && result.uri) {
      setImageUri(result.uri);
    } else if (result.error && result.error !== 'Sélection annulée') {
      Alert.alert('Erreur', result.error);
    }
  };

  // Prendre une photo avec la caméra
  const handleTakePhoto = async () => {
    const result = await activityStorageService.takePhoto();
    if (result.success && result.uri) {
      setImageUri(result.uri);
    } else if (result.error && result.error !== 'Capture annulée') {
      Alert.alert('Erreur', result.error);
    }
  };

  // Afficher le menu de sélection d'image
  const handleImageSelection = () => {
    Alert.alert(
      'Ajouter une photo',
      'Choisissez une option',
      [
        {
          text: 'Galerie',
          onPress: handlePickImage,
        },
        {
          text: 'Appareil photo',
          onPress: handleTakePhoto,
        },
        {
          text: 'Annuler',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  // Validation des champs
  const validateFields = (): boolean => {
    if (!nom.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Erreur', 'La description est requise');
      return false;
    }
    if (!categorie.trim()) {
      Alert.alert('Erreur', 'La catégorie est requise');
      return false;
    }
    if (!date.trim()) {
      Alert.alert('Erreur', 'La date est requise (format: YYYY-MM-DD)');
      return false;
    }
    // Validation du format de date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      Alert.alert('Erreur', 'Format de date invalide. Utilisez: YYYY-MM-DD');
      return false;
    }
    if (!timeStart.trim()) {
      Alert.alert('Erreur', 'L\'heure de début est requise (format: HH:MM)');
      return false;
    }
    // Validation du format d'heure
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(timeStart)) {
      Alert.alert('Erreur', 'Format d\'heure invalide. Utilisez: HH:MM (ex: 14:30)');
      return false;
    }
    if (timeEnd && !timeRegex.test(timeEnd)) {
      Alert.alert('Erreur', 'Format d\'heure de fin invalide. Utilisez: HH:MM');
      return false;
    }
    if (!adresse.trim()) {
      Alert.alert('Erreur', 'L\'adresse est requise');
      return false;
    }
    if (!ville.trim()) {
      Alert.alert('Erreur', 'La ville est requise');
      return false;
    }
    if (!maxParticipants.trim()) {
      Alert.alert('Erreur', 'Le nombre maximum de participants est requis');
      return false;
    }
    const maxNum = parseInt(maxParticipants);
    if (isNaN(maxNum) || maxNum < 1) {
      Alert.alert('Erreur', 'Le nombre maximum de participants doit être supérieur à 0');
      return false;
    }

    return true;
  };

  // Géocoder automatiquement l'adresse
  const handleGeocodeAddress = async () => {
    if (!adresse.trim() || !ville.trim()) {
      return; // Silencieux si pas d'adresse
    }

    setGeocoding(true);
    try {
      const fullAddress = codePostal.trim() 
        ? `${adresse.trim()}, ${codePostal.trim()} ${ville.trim()}`
        : `${adresse.trim()}, ${ville.trim()}`;
        
      const result = await geocodingService.geocodeAddress(
        fullAddress,
        ville.trim()
      );

      if (result) {
        setLatitude(result.latitude.toString());
        setLongitude(result.longitude.toString());
        console.log('✅ Coordonnées GPS trouvées automatiquement');
      }
    } catch (error) {
      console.error('Erreur géocodage:', error);
    } finally {
      setGeocoding(false);
    }
  };

  // Géocoder manuellement (bouton)
  const handleManualGeocode = async () => {
    if (!adresse.trim() || !ville.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir l\'adresse et la ville d\'abord');
      return;
    }

    setGeocoding(true);
    try {
      const fullAddress = codePostal.trim() 
        ? `${adresse.trim()}, ${codePostal.trim()} ${ville.trim()}`
        : `${adresse.trim()}, ${ville.trim()}`;
        
      const result = await geocodingService.geocodeAddress(
        fullAddress,
        ville.trim()
      );

      if (result) {
        setLatitude(result.latitude.toString());
        setLongitude(result.longitude.toString());
        Alert.alert(
          'Succès',
          'Coordonnées GPS trouvées !\n' + result.displayName
        );
      } else {
        Alert.alert(
          'Erreur',
          'Impossible de trouver les coordonnées pour cette adresse. Vous pouvez les saisir manuellement.'
        );
      }
    } catch (error) {
      console.error('Erreur géocodage:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors du géocodage');
    } finally {
      setGeocoding(false);
    }
  };

  const handleCreate = async () => {
    // Valider tous les champs obligatoires
    if (!validateFields()) {
      return;
    }

    // Vérifier les coordonnées GPS
    if (!latitude.trim() || !longitude.trim()) {
      Alert.alert(
        'Coordonnées GPS manquantes',
        'Les coordonnées GPS sont requises pour afficher l\'activité sur la carte. Voulez-vous les rechercher automatiquement ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Rechercher', onPress: handleManualGeocode },
        ]
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Upload de l'image si une image a été sélectionnée
      let uploadedImageUrl = imageUrl.trim();
      
      if (imageUri) {
        setUploadingImage(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Utilisateur non connecté');

        const uploadResult = await activityStorageService.uploadActivityImage(
          imageUri,
          user.id
        );

        if (uploadResult.success && uploadResult.url) {
          uploadedImageUrl = uploadResult.url;
        } else {
          Alert.alert(
            'Avertissement',
            'L\'image n\'a pas pu être uploadée. L\'activité sera créée avec une image par défaut.',
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
        date: date.trim(),
        time_start: timeStart.trim(),
        time_end: timeEnd.trim() || undefined,
        adresse: adresse.trim(),
        ville: ville.trim(),
        code_postal: codePostal.trim() || undefined,
        max_participants: parseInt(maxParticipants),
        image_url: uploadedImageUrl || undefined,
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
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <View style={styles.imageOverlay}>
                <IconSymbol name="camera.fill" size={24} color="white" />
                <Text style={styles.imageOverlayText}>Changer la photo</Text>
              </View>
            </View>
          ) : (
            <View style={styles.imageUploadPlaceholder}>
              <IconSymbol name="photo.fill" size={48} color={colors.textSecondary} />
              <Text style={styles.imageUploadText}>Ajouter une photo de l'activité</Text>
              <Text style={styles.imageUploadSubtext}>Touchez pour sélectionner</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          {/* Nom */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom de l'activité *</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Randonnée en forêt, Brunch entre amis"
              placeholderTextColor={colors.textSecondary}
              value={nom}
              onChangeText={setNom}
            />
          </View>

          {/* Titre (optionnel) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Titre secondaire (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Découverte de la nature"
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
              placeholder="Décrivez votre activité en détail"
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Catégorie */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Catégorie *</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Hiking, Brunch, Music, Gaming"
              placeholderTextColor={colors.textSecondary}
              value={categorie}
              onChangeText={setCategorie}
            />
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

          {/* Section optionnelle */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Coordonnées GPS</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Coordonnées GPS */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Latitude {geocoding && '⏳'}</Text>
              <TextInput
                style={[styles.input, geocoding && styles.inputDisabled]}
                placeholder="48.8566"
                placeholderTextColor={colors.textSecondary}
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="decimal-pad"
                editable={!geocoding}
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Longitude {geocoding && '⏳'}</Text>
              <TextInput
                style={[styles.input, geocoding && styles.inputDisabled]}
                placeholder="2.3522"
                placeholderTextColor={colors.textSecondary}
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="decimal-pad"
                editable={!geocoding}
              />
            </View>
          </View>

          {geocoding && (
            <View style={styles.geocodingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.geocodingText}>
                Recherche automatique des coordonnées GPS...
              </Text>
            </View>
          )}

          {latitude && longitude && !geocoding && (
            <View style={styles.successIndicator}>
              <IconSymbol name="checkmark.circle.fill" size={20} color="#10b981" />
              <Text style={styles.successText}>
                Coordonnées GPS trouvées ! L'activité sera visible sur la carte.
              </Text>
            </View>
          )}

          {/* Bouton de géocodage manuel (au cas où) */}
          {!geocoding && adresse.trim() && ville.trim() && (
            <TouchableOpacity
              style={styles.geocodeButton}
              onPress={handleManualGeocode}
            >
              <IconSymbol 
                name="location.fill" 
                size={20} 
                color={colors.primary} 
              />
              <Text style={styles.geocodeButtonText}>
                Rechercher à nouveau les coordonnées GPS
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.helperText}>
            💡 Les coordonnées GPS sont trouvées automatiquement dès que vous remplissez l'adresse et la ville. Vous pouvez aussi les modifier manuellement si besoin.
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
  footerNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
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
  geocodingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    marginBottom: 12,
  },
  geocodingText: {
    fontSize: 14,
    color: colors.primary,
    flex: 1,
  },
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#10b98120',
    borderRadius: 8,
    marginBottom: 12,
  },
  successText: {
    fontSize: 14,
    color: '#10b981',
    flex: 1,
    fontWeight: '500',
  },
  imageUploadZone: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  imageUploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  imageUploadSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  imagePreviewContainer: {
    flex: 1,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageOverlayText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});