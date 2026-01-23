// hooks/useBusinessRestrictions.ts
// Hook pour gérer les restrictions des comptes entreprise

import { useAuth } from '@/contexts/AuthContext';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

interface BusinessRestrictions {
  // États
  isBusiness: boolean;
  isUser: boolean;
  
  // Permissions
  canJoinActivities: boolean;
  canAddFriends: boolean;
  canSendMessages: boolean;
  canCreateActivities: boolean;
  canViewCompetitors: boolean;
  canViewActivityGroups: boolean;
  canReceiveFriendRequests: boolean;
  
  // Actions avec feedback
  showJoinRestriction: () => void;
  showFriendRestriction: () => void;
  showMessageRestriction: () => void;
  showFriendRequestRestriction: () => void;
  
  // Utilitaires
  checkPermission: (action: BusinessAction, showAlert?: boolean) => boolean;
  getAccountTypeLabel: () => string;
}

type BusinessAction = 'join' | 'friend' | 'message' | 'friend_request';

export function useBusinessRestrictions(): BusinessRestrictions {
  const { profile } = useAuth();
  const router = useRouter();
  
  const isBusiness = profile?.account_type === 'business';
  const isUser = profile?.account_type === 'user' || !profile?.account_type;

  // Messages d'alerte personnalisés
  const alertMessages: Record<BusinessAction, { title: string; message: string; alternative?: { text: string; route: string } }> = {
    join: {
      title: 'Action non disponible',
      message: 'En tant qu\'entreprise, vous ne pouvez pas participer aux activités. Vous pouvez uniquement créer des activités pour votre établissement.',
      alternative: { text: 'Créer une activité', route: '/create-activity' },
    },
    friend: {
      title: 'Action non disponible',
      message: 'Les comptes entreprise ne peuvent pas ajouter d\'amis. Les utilisateurs peuvent découvrir votre entreprise via vos activités.',
      alternative: { text: 'Voir mes activités', route: '/my-activities' },
    },
    message: {
      title: 'Action non disponible',
      message: 'Les comptes entreprise ne peuvent pas envoyer de messages directs aux utilisateurs. Vous pouvez observer les groupes de vos activités depuis l\'onglet "Groupes".',
      alternative: { text: 'Voir mes groupes', route: '/(tabs)/business-groups' },
    },
    friend_request: {
      title: 'Action non disponible',
      message: 'Les comptes entreprise ne peuvent pas recevoir ni envoyer de demandes d\'amis.',
    },
  };

  const showRestrictionAlert = (action: BusinessAction) => {
    const config = alertMessages[action];
    
    const buttons: any[] = [{ text: 'Compris', style: 'default' }];
    
    if (config.alternative) {
      buttons.push({
        text: config.alternative.text,
        onPress: () => router.push(config.alternative!.route as any),
        style: 'default',
      });
    }
    
    Alert.alert(config.title, config.message, buttons);
  };

  const showJoinRestriction = () => showRestrictionAlert('join');
  const showFriendRestriction = () => showRestrictionAlert('friend');
  const showMessageRestriction = () => showRestrictionAlert('message');
  const showFriendRequestRestriction = () => showRestrictionAlert('friend_request');

  const checkPermission = (action: BusinessAction, showAlert: boolean = true): boolean => {
    if (!isBusiness) return true;

    if (showAlert) {
      showRestrictionAlert(action);
    }

    return false;
  };

  const getAccountTypeLabel = (): string => {
    if (isBusiness) return 'Entreprise';
    return 'Utilisateur';
  };

  return {
    // États
    isBusiness,
    isUser,
    
    // Permissions
    canJoinActivities: !isBusiness,
    canAddFriends: !isBusiness,
    canSendMessages: !isBusiness,
    canCreateActivities: true, // Les deux types peuvent créer des activités
    canViewCompetitors: isBusiness, // Seulement les entreprises
    canViewActivityGroups: isBusiness, // Vue lecture seule pour les entreprises
    canReceiveFriendRequests: !isBusiness,
    
    // Actions
    showJoinRestriction,
    showFriendRestriction,
    showMessageRestriction,
    showFriendRequestRestriction,
    
    // Utilitaires
    checkPermission,
    getAccountTypeLabel,
  };
}

// Hook simplifié pour juste vérifier le type de compte
export function useAccountType(): 'user' | 'business' {
  const { profile } = useAuth();
  return profile?.account_type === 'business' ? 'business' : 'user';
}

// Fonction utilitaire (hors hook) pour les vérifications rapides
export function checkBusinessPermission(
  isBusiness: boolean,
  action: BusinessAction,
  showAlert: boolean = true
): boolean {
  if (!isBusiness) return true;

  if (showAlert) {
    const messages: Record<BusinessAction, { title: string; message: string }> = {
      join: {
        title: 'Action non disponible',
        message: 'En tant qu\'entreprise, vous ne pouvez pas participer aux activités.',
      },
      friend: {
        title: 'Action non disponible',
        message: 'Les comptes entreprise ne peuvent pas ajouter d\'amis.',
      },
      message: {
        title: 'Action non disponible',
        message: 'Les comptes entreprise ne peuvent pas envoyer de messages directs.',
      },
      friend_request: {
        title: 'Action non disponible',
        message: 'Les comptes entreprise ne peuvent pas gérer les demandes d\'amis.',
      },
    };

    Alert.alert(messages[action].title, messages[action].message);
  }

  return false;
}