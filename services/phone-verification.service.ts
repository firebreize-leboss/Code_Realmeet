// services/phone-verification.service.ts
// Service de vérification de numéro de téléphone via Supabase OTP SMS (MessageBird)

import { supabase } from '@/lib/supabase';

class PhoneVerificationService {
  // Flag pour que AuthContext ignore les events de session pendant la vérification OTP
  public isVerifyingPhone = false;

  /**
   * Envoie un code OTP par SMS au numéro donné.
   * Utilise signInWithOtp de Supabase pour déclencher l'envoi du SMS.
   */
  async sendOtp(fullPhoneNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
      });

      if (error) {
        if (error.message?.includes('rate') || error.message?.includes('frequency')) {
          return { success: false, error: 'Veuillez patienter avant de renvoyer un code' };
        }
        return { success: false, error: error.message || 'Erreur lors de l\'envoi du SMS' };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur réseau, vérifiez votre connexion' };
    }
  }

  /**
   * Vérifie le code OTP saisi par l'utilisateur.
   * Si la vérification crée une session Supabase, on la détruit
   * car l'utilisateur n'est pas encore inscrit (inscription par email/password ensuite).
   */
  async verifyOtp(fullPhoneNumber: string, otpCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.isVerifyingPhone = true;

      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: otpCode,
        type: 'sms',
      });

      if (error) {
        this.isVerifyingPhone = false;
        if (error.message?.includes('expired')) {
          return { success: false, error: 'Le code a expiré, demandez-en un nouveau' };
        }
        if (error.message?.includes('invalid') || error.message?.includes('Invalid')) {
          return { success: false, error: 'Code incorrect, veuillez réessayer' };
        }
        return { success: false, error: error.message || 'Erreur lors de la vérification' };
      }

      // Nettoyage : si une session a été créée, la détruire
      // L'inscription réelle se fait ensuite via registerUser() avec email/password
      if (data?.session) {
        await supabase.auth.signOut();
      }

      // Laisser le temps au listener d'ignorer l'event SIGNED_OUT
      await new Promise(resolve => setTimeout(resolve, 100));
      this.isVerifyingPhone = false;

      return { success: true };
    } catch (error: any) {
      this.isVerifyingPhone = false;
      return { success: false, error: error.message || 'Erreur réseau, vérifiez votre connexion' };
    }
  }
}

export const phoneVerificationService = new PhoneVerificationService();
