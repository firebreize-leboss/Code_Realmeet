// services/storage.service.ts
// Service de gestion du stockage d'images - Version corrigée

import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
// ✅ important : on utilise l'API legacy conseillée par Expo
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

class StorageService {
  private bucketName = 'avatars';

  /**
   * Upload d'un avatar
   */
  async uploadAvatar(uri: string, userId: string) {
    try {
      console.log('🔵 Upload avatar - URI:', uri);
      console.log('🔵 Upload avatar - UserID:', userId);

      // 1. Lire le fichier en base64 via l'API legacy
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      console.log('✅ Image convertie en base64');

      // 2. Générer un nom de fichier unique
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      console.log('🔵 Chemin fichier:', filePath);

      // 3. Upload vers Supabase Storage (ArrayBuffer)
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, decode(base64), {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) {
        console.error('❌ Erreur upload Supabase:', error);
        throw error;
      }

      console.log('✅ Upload réussi:', data);

      // 4. Récupérer l'URL publique
      const publicUrl = this.getAvatarUrl(data.path);

      console.log('✅ URL publique:', publicUrl);

      return {
        success: true,
        path: data.path,
        url: publicUrl,
        message: "Avatar uploadé avec succès !",
      };
    } catch (error: any) {
      console.error('❌ Erreur upload avatar:', error);
      return {
        success: false,
        error: error.message || "Erreur lors de l'upload",
      };
    }
  }

  /**
   * Récupérer l'URL publique d'un avatar
   */
  getAvatarUrl(path: string): string {
    const { data } = supabase.storage.from(this.bucketName).getPublicUrl(path);
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
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        return {
          success: false,
          error: 'Permission refusée',
        };
      }

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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        return {
          success: false,
          error: 'Permission refusée',
        };
      }

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

  /**
   * Upload d'une image d'activité
   */
  async uploadActivityImage(uri: string) {
    try {
      console.log('🔵 Upload image activité - URI:', uri);

      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      console.log('✅ Image convertie en base64');

      // Générer un nom de fichier unique
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `activities/${user.id}/${fileName}`;

      console.log('🔵 Chemin fichier:', filePath);

      // Upload vers Supabase Storage (bucket 'activity-images')
      const { data, error } = await supabase.storage
        .from('activity-images')
        .upload(filePath, decode(base64), {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (error) {
        console.error('❌ Erreur upload Supabase:', error);
        throw error;
      }

      console.log('✅ Upload réussi:', data);

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('activity-images')
        .getPublicUrl(data.path);

      console.log('✅ URL publique:', urlData.publicUrl);

      return {
        success: true,
        path: data.path,
        url: urlData.publicUrl,
        message: 'Image uploadée avec succès !',
      };
    } catch (error: any) {
      console.error('❌ Erreur upload image activité:', error);
      return {
        success: false,
        error: error.message || "Erreur lors de l'upload",
      };
    }
  }
}

export const storageService = new StorageService();