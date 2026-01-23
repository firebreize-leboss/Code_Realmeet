// services/message-storage.service.ts
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
// ✅ Utiliser l'API legacy pour éviter les erreurs
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

class MessageStorageService {
  private imageBucketName = 'chat-images';
  private voiceBucketName = 'voice-messages';

  /**
   * Upload d'une image de message - CORRIGÉ avec base64
   */
  async uploadImage(uri: string): Promise<string> {
    try {
      console.log('🔵 Upload image message depuis:', uri);

      // ✅ Vérifier que le fichier existe
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('📁 Info fichier:', fileInfo);

      if (!fileInfo.exists) {
        throw new Error('Fichier image introuvable');
      }

      // ✅ Lire le fichier en base64 (méthode fiable sur React Native)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('✅ Image lue en base64, longueur:', base64.length);

      // Générer un nom de fichier unique
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;

      console.log('🔵 Nom du fichier:', fileName);

      // ✅ Upload vers Supabase Storage avec decode base64
      const { data, error } = await supabase.storage
        .from(this.imageBucketName)
        .upload(fileName, decode(base64), {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: false,
        });

      if (error) {
        console.error('❌ Erreur upload Supabase:', error);
        throw error;
      }

      console.log('✅ Upload réussi:', data);

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from(this.imageBucketName)
        .getPublicUrl(data.path);

      console.log('✅ URL publique:', urlData.publicUrl);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('❌ Erreur upload image message:', error);
      throw new Error(error.message || "Erreur lors de l'upload de l'image");
    }
  }

  /**
   * Upload d'un message vocal - Version corrigée
   */
  async uploadVoiceMessage(uri: string): Promise<string> {
    try {
      console.log('🎤 Upload message vocal depuis:', uri);

      // Vérifier que le fichier existe
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('📁 Info fichier:', fileInfo);

      if (!fileInfo.exists) {
        throw new Error('Fichier audio introuvable');
      }

      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('✅ Fichier vocal lu en base64, longueur:', base64.length);

      // Générer un nom de fichier unique
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'm4a';
      const fileName = `${Date.now()}.${fileExt}`;

      console.log('🔵 Nom du fichier vocal:', fileName);

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.voiceBucketName)
        .upload(fileName, decode(base64), {
          contentType: fileExt === '3gp' ? 'audio/3gpp' : 'audio/mp4',
          upsert: false,
        });

      if (error) {
        console.error('❌ Erreur upload vocal Supabase:', error);
        throw error;
      }

      console.log('✅ Upload vocal réussi:', data);

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from(this.voiceBucketName)
        .getPublicUrl(data.path);

      console.log('✅ URL publique vocal:', urlData.publicUrl);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('❌ Erreur upload message vocal:', error);
      throw new Error(error.message || "Erreur lors de l'upload du message vocal");
    }
  }

  /**
   * Upload d'une image de message avec asset complet (alternative)
   */
  async uploadMessageImage(
    asset: ImagePicker.ImagePickerAsset,
    conversationId: string,
    userId: string
  ): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      console.log('🔵 Upload image message avec asset');

      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Générer un nom de fichier unique
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${conversationId}/${userId}-${Date.now()}.${fileExt}`;

      console.log('🔵 Chemin fichier:', fileName);

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.imageBucketName)
        .upload(fileName, decode(base64), {
          contentType: asset.mimeType || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: false,
        });

      if (error) {
        console.error('❌ Erreur upload Supabase:', error);
        throw error;
      }

      console.log('✅ Upload réussi:', data);

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from(this.imageBucketName)
        .getPublicUrl(data.path);

      console.log('✅ URL publique:', urlData.publicUrl);

      return {
        success: true,
        url: urlData.publicUrl,
      };
    } catch (error: any) {
      console.error('❌ Erreur upload image message:', error);
      return {
        success: false,
        error: error.message || "Erreur lors de l'upload",
      };
    }
  }
}

export const messageStorageService = new MessageStorageService();