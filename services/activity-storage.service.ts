import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

class ActivityStorageService {
  private bucketName = 'activity-images';

  /**
   * Créer le bucket s'il n'existe pas (à exécuter une fois)
   */
  async createBucketIfNeeded() {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = buckets?.some(b => b.name === this.bucketName);
      
      if (!exists) {
        await supabase.storage.createBucket(this.bucketName, {
          public: true,
          fileSizeLimit: 5242880, // 5MB
        });
        console.log('✅ Bucket activity-images créé');
      }
    } catch (error) {
      console.error('Erreur création bucket:', error);
    }
  }

  /**
   * Sélectionner une image depuis la galerie
   */
  async pickImage() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        return {
          success: false,
          error: 'Permission refusée pour accéder à la galerie',
        };
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9], // Format paysage pour les activités
        quality: 0.8,
      });

      if (result.canceled) {
        return {
          success: false,
          error: 'Sélection annulée',
        };
      }

      return {
        success: true,
        uri: result.assets[0].uri,
      };
    } catch (error: any) {
      console.error('Erreur sélection image:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Prendre une photo avec la caméra
   */
  async takePhoto() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        return {
          success: false,
          error: 'Permission refusée pour accéder à la caméra',
        };
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled) {
        return {
          success: false,
          error: 'Capture annulée',
        };
      }

      return {
        success: true,
        uri: result.assets[0].uri,
      };
    } catch (error: any) {
      console.error('Erreur capture photo:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Upload d'une image d'activité
   */
  async uploadActivityImage(uri: string, userId: string) {
    try {
      console.log('🔵 Upload image activité - URI:', uri);

      // 1. Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      console.log('✅ Image convertie en base64');

      // 2. Générer un nom de fichier unique
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      console.log('🔵 Chemin fichier:', filePath);

      // 3. Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, decode(base64), {
          contentType: `image/${fileExt}`,
          upsert: false, // Ne pas écraser les anciennes images
        });

      if (error) {
        console.error('❌ Erreur upload Supabase:', error);
        throw error;
      }

      console.log('✅ Upload réussi:', data);

      // 4. Récupérer l'URL publique
      const publicUrl = this.getImageUrl(data.path);

      console.log('✅ URL publique:', publicUrl);

      return {
        success: true,
        path: data.path,
        url: publicUrl,
        message: 'Image uploadée avec succès !',
      };
    } catch (error: any) {
      console.error('❌ Erreur upload image:', error);
      return {
        success: false,
        error: error.message || "Erreur lors de l'upload",
      };
    }
  }

  /**
   * Récupérer l'URL publique d'une image
   */
  getImageUrl(path: string): string {
    const { data } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Supprimer une image d'activité
   */
  async deleteActivityImage(path: string) {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([path]);

      if (error) throw error;

      return {
        success: true,
        message: 'Image supprimée',
      };
    } catch (error: any) {
      console.error('Erreur suppression image:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const activityStorageService = new ActivityStorageService();