import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

class StorageService {
  private bucketName = 'avatars';

  /**
   * Upload d'un avatar
   */
  async uploadAvatar(uri: string, userId: string) {
    try {
      // 1. Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 2. Générer un nom de fichier unique
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // 3. Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, decode(base64), {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) throw error;

      // 4. Récupérer l'URL publique
      const publicUrl = this.getAvatarUrl(data.path);

      return {
        success: true,
        path: data.path,
        url: publicUrl,
        message: 'Avatar uploadé avec succès !',
      };
    } catch (error: any) {
      console.error('Erreur upload avatar:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'upload',
      };
    }
  }

  /**
   * Récupérer l'URL publique d'un avatar
   */
  getAvatarUrl(path: string): string {
    const { data } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Supprimer un avatar
   */
  async deleteAvatar(path: string) {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([path]);

      if (error) throw error;

      return {
        success: true,
        message: 'Avatar supprimé',
      };
    } catch (error: any) {
      console.error('Erreur suppression avatar:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sélectionner une image depuis la galerie
   */
  async pickImage() {
    try {
      // Demander la permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        return {
          success: false,
          error: 'Permission refusée',
        };
      }

      // Ouvrir la galerie
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
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
      // Demander la permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        return {
          success: false,
          error: 'Permission refusée',
        };
      }

      // Ouvrir la caméra
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
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
}

export const storageService = new StorageService();