import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

class MessageStorageService {
  private bucketName = 'chat-images';

  /**
   * Upload d'une image de message - VERSION SIMPLIFIÉE
   */
  async uploadMessageImage(
    asset: ImagePicker.ImagePickerAsset, // ✅ Recevoir l'asset complet
    conversationId: string,
    userId: string
  ): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      console.log('🔵 Upload image message');

      // Vérifier que base64 existe
      if (!asset.base64) {
        throw new Error('Données base64 manquantes');
      }

      // Générer un nom de fichier unique
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${conversationId}/${userId}-${Date.now()}.${fileExt}`;

      console.log('🔵 Chemin fichier:', fileName);

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, decode(asset.base64), {
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