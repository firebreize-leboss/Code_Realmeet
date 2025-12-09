// services/message-storage.service.ts
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

class MessageStorageService {
  private imageBucketName = 'chat-images';
  private voiceBucketName = 'voice-messages';

  /**
   * Lire un fichier et le convertir en ArrayBuffer
   */
  private async uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function () {
        reject(new Error('Erreur lecture fichier'));
      };
      xhr.responseType = 'arraybuffer';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  }

  /**
   * Upload d'une image de message
   */
  async uploadImage(uri: string): Promise<string> {
    try {
      console.log('🔵 Upload image message depuis:', uri);

      // Lire le fichier en ArrayBuffer
      const arrayBuffer = await this.uriToArrayBuffer(uri);

      // Générer un nom de fichier unique
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;

      console.log('🔵 Nom du fichier:', fileName);

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.imageBucketName)
        .upload(fileName, arrayBuffer, {
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
   * Upload d'un message vocal
   */
  async uploadVoiceMessage(uri: string): Promise<string> {
    try {
      console.log('🎤 Upload message vocal depuis:', uri);

      // Lire le fichier en ArrayBuffer
      const arrayBuffer = await this.uriToArrayBuffer(uri);

      console.log('✅ Fichier vocal lu, taille:', arrayBuffer.byteLength);

      // Générer un nom de fichier unique
      const fileName = `${Date.now()}.m4a`;

      console.log('🔵 Nom du fichier vocal:', fileName);

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.voiceBucketName)
        .upload(fileName, arrayBuffer, {
          contentType: 'audio/m4a',
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
   * Upload d'une image de message avec asset complet
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
      console.log('🔵 Upload image message');

      // Lire le fichier en ArrayBuffer
      const arrayBuffer = await this.uriToArrayBuffer(asset.uri);

      // Générer un nom de fichier unique
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${conversationId}/${userId}-${Date.now()}.${fileExt}`;

      console.log('🔵 Chemin fichier:', fileName);

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.imageBucketName)
        .upload(fileName, arrayBuffer, {
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