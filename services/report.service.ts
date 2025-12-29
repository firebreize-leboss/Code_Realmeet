// services/report.service.ts
// Service de gestion des signalements (profils, messages, activités)

import { supabase } from '@/lib/supabase';

// Types pour les signalements
export type ReportTargetType = 'profile' | 'message' | 'activity';

export type ReportReason = 
  | 'harassment'
  | 'spam'
  | 'fake_profile'
  | 'inappropriate'
  | 'dangerous'
  | 'scam'
  | 'hate_speech'
  | 'other';

export interface ReportData {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

export interface ReportResult {
  success: boolean;
  error?: string;
  isDuplicate?: boolean;
}

// Labels français pour les raisons de signalement
export const REPORT_REASONS: { value: ReportReason; label: string; icon: string }[] = [
  { value: 'harassment', label: 'Harcèlement', icon: 'exclamationmark.shield.fill' },
  { value: 'spam', label: 'Spam / Publicité', icon: 'envelope.badge.fill' },
  { value: 'fake_profile', label: 'Faux profil', icon: 'person.crop.circle.badge.questionmark' },
  { value: 'inappropriate', label: 'Contenu inapproprié', icon: 'eye.slash.fill' },
  { value: 'dangerous', label: 'Comportement dangereux', icon: 'exclamationmark.triangle.fill' },
  { value: 'scam', label: 'Arnaque / Fraude', icon: 'creditcard.trianglebadge.exclamationmark' },
  { value: 'hate_speech', label: 'Discours haineux', icon: 'hand.raised.slash.fill' },
  { value: 'other', label: 'Autre raison', icon: 'ellipsis.circle.fill' },
];

// Labels pour les types de cible (pour les messages de confirmation)
export const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  profile: 'cet utilisateur',
  message: 'ce message',
  activity: 'cette activité',
};

class ReportService {
  /**
   * Créer un signalement
   */
  async createReport(data: ReportData): Promise<ReportResult> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        return { success: false, error: 'Vous devez être connecté pour signaler.' };
      }

      // Empêcher de se signaler soi-même (pour les profils)
      if (data.targetType === 'profile' && data.targetId === user.id) {
        return { success: false, error: 'Vous ne pouvez pas vous signaler vous-même.' };
      }

      const { error } = await supabase
        .from('reports')
        .insert({
          reported_by: user.id,
          target_type: data.targetType,
          target_id: data.targetId,
          reason: data.reason,
          description: data.description?.trim() || null,
        });

      if (error) {
        // Gestion de l'erreur de doublon (contrainte UNIQUE)
        if (error.code === '23505') {
          return { 
            success: false, 
            error: 'Vous avez déjà signalé cet élément.',
            isDuplicate: true 
          };
        }
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erreur création signalement:', error);
      return { 
        success: false, 
        error: error.message || 'Une erreur est survenue lors du signalement.' 
      };
    }
  }

  /**
   * Vérifier si l'utilisateur a déjà signalé une cible
   * Note: Cette fonction ne marchera pas avec RLS strict car SELECT est bloqué
   * On gère donc le doublon via l'erreur 23505 lors de l'insert
   */
  async hasAlreadyReported(targetType: ReportTargetType, targetId: string): Promise<boolean> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) return false;

      // Cette requête échouera silencieusement avec RLS, donc on retourne false
      // Le vrai check se fait via l'erreur de doublon lors de l'insert
      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('reported_by', user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .maybeSingle();

      if (error) {
        // Erreur RLS attendue - l'utilisateur n'a pas accès en lecture
        return false;
      }

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Obtenir le label français d'une raison
   */
  getReasonLabel(reason: ReportReason): string {
    const found = REPORT_REASONS.find(r => r.value === reason);
    return found?.label || reason;
  }

  /**
   * Obtenir l'icône d'une raison
   */
  getReasonIcon(reason: ReportReason): string {
    const found = REPORT_REASONS.find(r => r.value === reason);
    return found?.icon || 'exclamationmark.circle.fill';
  }
}

export const reportService = new ReportService();