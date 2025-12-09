// services/voice-message.service.ts
// Service de gestion des messages vocaux

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';

class VoiceMessageService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private recordingStartTime: number = 0;

  /**
   * Demander les permissions audio
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Erreur permission audio:', error);
      return false;
    }
  }

  /**
   * Configurer le mode audio pour l'enregistrement
   */
  async setupAudioMode(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }

  /**
   * Démarrer l'enregistrement
   */
  async startRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return { success: false, error: 'Permission microphone refusée' };
      }

      await this.setupAudioMode();

      // Arrêter tout enregistrement précédent
      if (this.recording) {
        await this.stopRecording();
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.recordingStartTime = Date.now();

      return { success: true };
    } catch (error: any) {
      console.error('Erreur démarrage enregistrement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Arrêter l'enregistrement et récupérer le fichier
   */
  async stopRecording(): Promise<{
    success: boolean;
    uri?: string;
    duration?: number;
    error?: string;
  }> {
    try {
      if (!this.recording) {
        return { success: false, error: 'Aucun enregistrement en cours' };
      }

      const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      this.recording = null;

      // Réinitialiser le mode audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (!uri) {
        return { success: false, error: 'Fichier audio non trouvé' };
      }

      return { success: true, uri, duration };
    } catch (error: any) {
      console.error('Erreur arrêt enregistrement:', error);
      this.recording = null;
      return { success: false, error: error.message };
    }
  }

  /**
   * Annuler l'enregistrement en cours
   */
  async cancelRecording(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (error) {
      console.error('Erreur annulation enregistrement:', error);
    }
  }

  /**
   * Upload du message vocal vers Supabase Storage
   */
  async uploadVoiceMessage(
    localUri: string,
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Générer un nom unique
      const fileName = `${conversationId}/${userId}_${Date.now()}.m4a`;

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, decode(base64), {
          contentType: 'audio/m4a',
          upsert: false,
        });

      if (error) throw error;

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(data.path);

      return { success: true, url: urlData.publicUrl };
    } catch (error: any) {
      console.error('Erreur upload vocal:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Jouer un message vocal
   */
  async playVoiceMessage(url: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Arrêter tout son en cours
      await this.stopPlayback();

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );

      this.sound = sound;

      // Écouter la fin de la lecture
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.stopPlayback();
        }
      });

      return { success: true };
    } catch (error: any) {
      console.error('Erreur lecture vocale:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mettre en pause la lecture
   */
  async pausePlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.pauseAsync();
      }
    } catch (error) {
      console.error('Erreur pause:', error);
    }
  }

  /**
   * Reprendre la lecture
   */
  async resumePlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.playAsync();
      }
    } catch (error) {
      console.error('Erreur reprise:', error);
    }
  }

  /**
   * Arrêter la lecture
   */
  async stopPlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      }
    } catch (error) {
      console.error('Erreur arrêt lecture:', error);
    }
  }

  /**
   * Récupérer la durée d'enregistrement actuelle
   */
  getCurrentRecordingDuration(): number {
    if (!this.recording || !this.recordingStartTime) return 0;
    return Math.floor((Date.now() - this.recordingStartTime) / 1000);
  }

  /**
   * Vérifier si un enregistrement est en cours
   */
  isRecording(): boolean {
    return this.recording !== null;
  }

  /**
   * Nettoyer les ressources
   */
  async cleanup(): Promise<void> {
    await this.cancelRecording();
    await this.stopPlayback();
  }
}

export const voiceMessageService = new VoiceMessageService();