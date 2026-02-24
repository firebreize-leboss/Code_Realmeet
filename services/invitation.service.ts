import { supabase } from '@/lib/supabase';
import { Share } from 'react-native';

// ============================================
// TYPES
// ============================================

export interface PlusOneInvitation {
  id: string;
  slotId: string;
  inviterId: string;
  inviteeId?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  paymentMode: 'host_pays' | 'guest_pays';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface InvitationPreview {
  id: string;
  slotId: string;
  activityId: string;
  price: number;
  inviterName: string;
  inviterAvatar: string;
  activityName: string;
  activityImage: string;
  slotDate: string;
  slotTime: string;
  location: string;
  expiresAt: string;
  paymentMode: string;
}

// ============================================
// SERVICE
// ============================================

class InvitationService {
  // ============================================
  // CREATION D'INVITATION
  // ============================================

  /**
   * Crée une nouvelle invitation +1 pour un créneau
   */
  async createInvitation(slotId: string): Promise<{
    success: boolean;
    token?: string;
    invitationId?: string;
    error?: string;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase.rpc('create_plus_one_invitation', {
        p_slot_id: slotId,
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: this.translateError(data.error),
        };
      }

      return {
        success: true,
        token: data.token,
        invitationId: data.invitation_id,
      };
    } catch (error: any) {
      console.error('Erreur création invitation:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la création de l\'invitation',
      };
    }
  }

  // ============================================
  // VALIDATION DE TOKEN
  // ============================================

  /**
   * Valide un token d'invitation et retourne les informations associées
   */
  async validateToken(token: string): Promise<{
    valid: boolean;
    invitation?: InvitationPreview;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('validate_plus_one_token', {
        p_token: token,
      });

      if (error) throw error;

      if (!data.valid) {
        return {
          valid: false,
          error: this.translateError(data.error),
        };
      }

      const inv = data.invitation;
      return {
        valid: true,
        invitation: {
          id: inv.id,
          slotId: inv.slot_id,
          activityId: inv.activity_id,
          price: inv.price ?? 0,
          inviterName: inv.inviter_name,
          inviterAvatar: inv.inviter_avatar,
          activityName: inv.activity_name,
          activityImage: inv.activity_image,
          slotDate: inv.slot_date,
          slotTime: inv.slot_time,
          location: inv.location,
          expiresAt: inv.expires_at,
          paymentMode: inv.payment_mode,
        },
      };
    } catch (error: any) {
      console.error('Erreur validation token:', error);
      return {
        valid: false,
        error: error.message || 'Erreur lors de la validation du token',
      };
    }
  }

  // ============================================
  // ACCEPTATION D'INVITATION
  // ============================================

  /**
   * Accepte une invitation +1 et inscrit l'utilisateur au créneau
   */
  async acceptInvitation(token: string): Promise<{
    success: boolean;
    slotId?: string;
    activityId?: string;
    error?: string;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase.rpc('accept_plus_one_invitation', {
        p_token: token,
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: this.translateError(data.error),
        };
      }

      return {
        success: true,
        slotId: data.slot_id,
        activityId: data.activity_id,
      };
    } catch (error: any) {
      console.error('Erreur acceptation invitation:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'acceptation de l\'invitation',
      };
    }
  }

  // ============================================
  // ANNULATION D'INVITATION
  // ============================================

  /**
   * Annule une invitation +1 en attente
   */
  async cancelInvitation(invitationId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase.rpc('cancel_plus_one_invitation', {
        p_invitation_id: invitationId,
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: this.translateError(data.error),
        };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erreur annulation invitation:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'annulation de l\'invitation',
      };
    }
  }

  // ============================================
  // RECUPERATION DES INVITATIONS
  // ============================================

  /**
   * Récupère les invitations +1 en attente pour un créneau
   */
  async getPendingInvitations(slotId: string): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      token: string;
      inviterName: string;
      createdAt: string;
      expiresAt: string;
    }>;
    error?: string;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase.rpc('get_pending_invitations', {
        p_slot_id: slotId,
      });

      if (error) throw error;

      const invitations = (data || []).map((inv: any) => ({
        id: inv.id,
        token: inv.token,
        inviterName: inv.inviter_name,
        createdAt: inv.created_at,
        expiresAt: inv.expires_at,
      }));

      return {
        success: true,
        data: invitations,
      };
    } catch (error: any) {
      console.error('Erreur récupération invitations:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la récupération des invitations',
      };
    }
  }

  /**
   * Récupère l'invitation en attente de l'utilisateur courant pour un créneau
   */
  async getMyPendingInvitation(slotId: string): Promise<{
    success: boolean;
    invitation?: PlusOneInvitation;
    error?: string;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase
        .from('plus_one_invitations')
        .select('*')
        .eq('slot_id', slotId)
        .eq('inviter_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return { success: true, invitation: undefined };
      }

      return {
        success: true,
        invitation: {
          id: data.id,
          slotId: data.slot_id,
          inviterId: data.inviter_id,
          inviteeId: data.invitee_id,
          token: data.token,
          status: data.status,
          paymentMode: data.payment_mode,
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          acceptedAt: data.accepted_at,
        },
      };
    } catch (error: any) {
      console.error('Erreur récupération invitation:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la récupération de l\'invitation',
      };
    }
  }

  // ============================================
  // PARTAGE
  // ============================================

  /**
   * Génère le lien de partage pour une invitation
   */
  generateShareLink(token: string): string {
    return `https://realmeet.fr/invite/${token}`;
  }

  /**
   * Partage une invitation via le système natif
   */
  async shareInvitation(token: string, activityName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const link = this.generateShareLink(token);
      const message = `Rejoins-moi pour "${activityName}" !\n\nClique sur ce lien pour accepter mon invitation (tu as 10 minutes) :\n${link}`;

      const result = await Share.share({
        message,
        title: `Invitation +1 - ${activityName}`,
      });

      if (result.action === Share.dismissedAction) {
        return { success: false, error: 'Partage annulé' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erreur partage invitation:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du partage',
      };
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Vérifie si l'utilisateur peut créer une invitation +1 pour un créneau
   */
  async canCreateInvitation(slotId: string): Promise<{
    canCreate: boolean;
    reason?: string;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { canCreate: false, reason: 'Non connecté' };
      }

      // Vérifier si l'utilisateur est participant
      const { data: participation } = await supabase
        .from('slot_participants')
        .select('id')
        .eq('slot_id', slotId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!participation) {
        return { canCreate: false, reason: 'Vous devez être inscrit à ce créneau' };
      }

      // Vérifier le mode Discover
      const { data: slot } = await supabase
        .from('activity_slots')
        .select('discover_mode')
        .eq('id', slotId)
        .single();

      if (slot?.discover_mode) {
        return { canCreate: false, reason: 'Mode Discover activé' };
      }

      // Vérifier si une invitation pending existe déjà
      const { data: existingInvitation } = await supabase
        .from('plus_one_invitations')
        .select('id')
        .eq('slot_id', slotId)
        .eq('inviter_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingInvitation) {
        return { canCreate: false, reason: 'Vous avez déjà une invitation en attente' };
      }

      return { canCreate: true };
    } catch (error: any) {
      console.error('Erreur vérification invitation:', error);
      return { canCreate: false, reason: 'Erreur de vérification' };
    }
  }

  /**
   * Traduit les codes d'erreur en messages français
   */
  private translateError(errorCode: string): string {
    const translations: Record<string, string> = {
      'NOT_AUTHENTICATED': 'Vous devez être connecté',
      'SLOT_NOT_FOUND': 'Créneau introuvable',
      'NOT_PARTICIPANT': 'Vous devez être inscrit à ce créneau',
      'DISCOVER_MODE': 'Les invitations +1 sont désactivées pour ce créneau (mode Discover)',
      'ALREADY_HAS_PENDING': 'Vous avez déjà une invitation en attente pour ce créneau',
      'MAX_PLUS_ONE_REACHED': 'Le nombre maximum de +1 a été atteint pour ce créneau',
      'TOKEN_NOT_FOUND': 'Lien d\'invitation invalide',
      'INVITATION_EXPIRED': 'Cette invitation a expiré',
      'INVITATION_ALREADY_USED': 'Cette invitation a déjà été utilisée',
      'INVITATION_CANCELLED': 'Cette invitation a été annulée',
      'CANNOT_INVITE_SELF': 'Vous ne pouvez pas accepter votre propre invitation',
      'ALREADY_PARTICIPANT': 'Vous êtes déjà inscrit à ce créneau',
      'SLOT_FULL': 'Ce créneau est complet',
      'INVITATION_NOT_FOUND': 'Invitation introuvable',
      'NOT_AUTHORIZED': 'Vous n\'êtes pas autorisé à effectuer cette action',
      'CANNOT_CANCEL': 'Cette invitation ne peut pas être annulée',
    };

    return translations[errorCode] || errorCode;
  }
}

export const invitationService = new InvitationService();
