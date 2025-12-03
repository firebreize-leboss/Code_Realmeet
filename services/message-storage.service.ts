// services/message-storage.service.ts
// Service pour uploader les images de messages

import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

class MessageStorageService {
  private bucketName = 'chat-images';

  /**
   * Upload d'une image de message
   */
  async uploadMessageImage(uri: string, conversationId: string, userId: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      console.log('🔵 Upload image message - URI:', uri);

      // 1. Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('✅ Image convertie en base64, taille:', base64.length);

      // 2. Générer un nom de fichier unique
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${conversationId}/${userId}-${Date.now()}.${fileExt}`;

      console.log('🔵 Chemin fichier:', fileName);

      // 3. Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, decode(base64), {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: false,
        });

      if (error) {
        console.error('❌ Erreur upload Supabase:', error);
        throw error;
      }

      console.log('✅ Upload réussi:', data);

      // 4. Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
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