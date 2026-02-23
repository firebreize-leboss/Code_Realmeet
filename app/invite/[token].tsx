// app/invite/[token].tsx
// Route de deep link pour les invitations +1

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { invitationService, InvitationPreview } from '@/services/invitation.service';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ScreenState = 'loading' | 'not_authenticated' | 'valid' | 'error' | 'accepting' | 'success';

export default function InviteTokenScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  const tokenString = typeof token === 'string' ? token : '';

  const [state, setState] = useState<ScreenState>('loading');
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    checkAuthAndValidate();
  }, [tokenString]);

  const checkAuthAndValidate = async () => {
    setState('loading');
    setError(null);

    try {
      // Vérifier l'authentification
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);

      if (!user) {
        setState('not_authenticated');
        return;
      }

      // Valider le token
      const result = await invitationService.validateToken(tokenString);

      if (!result.valid) {
        setError(result.error || 'Invitation invalide');
        setState('error');
        return;
      }

      setInvitation(result.invitation!);
      setState('valid');
    } catch (err: any) {
      setError(err.message || 'Erreur inattendue');
      setState('error');
    }
  };

  // Countdown timer temps réel
  useEffect(() => {
    if (!invitation?.expiresAt) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(invitation.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setCountdown('00:00');
        setError('Cette invitation a expiré');
        setState('error');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [invitation?.expiresAt]);

  const handleAccept = () => {
    if (!invitation) return;

    const slotDateFormatted = invitation.slotDate
      ? new Date(invitation.slotDate).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : '';

    const priceStr = invitation.price ? `${invitation.price}€` : 'Gratuit';

    router.push({
      pathname: '/payment/select-method',
      params: {
        activity_id: invitation.activityId,
        slot_id: invitation.slotId,
        activity_name: invitation.activityName,
        slot_date: slotDateFormatted,
        slot_time: invitation.slotTime || '',
        price: priceStr,
        host_id: '',
        is_plus_one: 'true',
        invitation_token: tokenString,
      },
    });
  };

  const handleDecline = () => {
    Alert.alert(
      'Décliner l\'invitation',
      'Êtes-vous sûr de vouloir décliner cette invitation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Décliner',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const handleLogin = () => {
    // Stocker le token pour rediriger après connexion
    router.push({
      pathname: '/auth/login',
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  const formatExpirationCountdown = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expirée';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `Expire dans ${diffHours}h ${diffMinutes}min`;
    }
    return `Expire dans ${diffMinutes} minutes`;
  };

  // Écran de chargement
  if (state === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Vérification de l'invitation...</Text>
      </View>
    );
  }

  // Écran non authentifié
  if (state === 'not_authenticated') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.iconCircleLarge}>
            <IconSymbol name="person.badge.plus" size={48} color={colors.primary} />
          </View>
          <Text style={styles.authTitle}>Invitation +1</Text>
          <Text style={styles.authDescription}>
            Vous avez reçu une invitation pour rejoindre une activité. Connectez-vous pour l'accepter.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Se connecter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => router.back()}>
            <Text style={styles.ghostButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Écran d'erreur
  if (state === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={[styles.iconCircleLarge, { backgroundColor: colors.errorLight }]}>
            <IconSymbol name="xmark" size={48} color={colors.error} />
          </View>
          <Text style={styles.errorTitle}>Invitation invalide</Text>
          <Text style={styles.errorDescription}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)/browse')}>
            <Text style={styles.primaryButtonText}>Découvrir les activités</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => router.back()}>
            <Text style={styles.ghostButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Écran de succès
  if (state === 'success') {
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.iconCircleLarge, { backgroundColor: colors.successLight }]}>
          <IconSymbol name="checkmark" size={48} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>Inscription réussie !</Text>
        <Text style={styles.successDescription}>
          Tu as rejoint l'activité. Redirection en cours...
        </Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  // Écran d'acceptation en cours
  if (state === 'accepting') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Inscription en cours...</Text>
      </View>
    );
  }

  // Écran d'invitation valide
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hero Image */}
      <View style={styles.heroContainer}>
        {invitation?.activityImage ? (
          <Image
            source={{ uri: invitation.activityImage }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <IconSymbol name="photo" size={64} color={colors.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.heroGradient}
        />
        <View style={styles.badgeContainer}>
          <View style={styles.inviteBadge}>
            <IconSymbol name="person.badge.plus" size={14} color={colors.background} />
            <Text style={styles.inviteBadgeText}>Invitation +1</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <IconSymbol name="xmark" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.activityTitle}>{invitation?.activityName}</Text>

        {/* Inviter Section */}
        <View style={styles.inviterSection}>
          {invitation?.inviterAvatar ? (
            <Image source={{ uri: invitation.inviterAvatar }} style={styles.inviterAvatar} />
          ) : (
            <View style={[styles.inviterAvatar, styles.avatarPlaceholder]}>
              <IconSymbol name="person.fill" size={24} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.inviterInfo}>
            <Text style={styles.inviterLabel}>Tu as été invité(e) par</Text>
            <Text style={styles.inviterName}>{invitation?.inviterName}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <IconSymbol name="calendar" size={20} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {invitation ? formatDate(invitation.slotDate) : ''}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <IconSymbol name="clock" size={20} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {invitation ? formatTime(invitation.slotTime) : ''}
            </Text>
          </View>
          {invitation?.location && (
            <View style={styles.detailRow}>
              <IconSymbol name="mappin" size={20} color={colors.textSecondary} />
              <Text style={styles.detailText} numberOfLines={2}>
                {invitation.location}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Info */}
        {invitation?.paymentMode === 'host_pays' && (
          <View style={styles.freeBox}>
            <IconSymbol name="gift.fill" size={20} color={colors.success} />
            <Text style={styles.freeText}>Gratuit pour toi !</Text>
          </View>
        )}

        {/* Expiration countdown temps réel */}
        <View style={styles.expirationBox}>
          <IconSymbol name="clock.badge.exclamationmark" size={16} color={colors.warning} />
          <Text style={styles.expirationText}>
            Expire dans {countdown}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={handleAccept}
          activeOpacity={0.8}
        >
          <IconSymbol name="checkmark" size={20} color={colors.background} />
          <Text style={styles.acceptButtonText}>Rejoindre l'activité</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={handleDecline}
          activeOpacity={0.7}
        >
          <Text style={styles.declineButtonText}>Décliner</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.base,
    color: colors.textSecondary,
  },

  // Hero
  heroContainer: {
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: 280,
  },
  heroPlaceholder: {
    backgroundColor: colors.backgroundAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  badgeContainer: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
  },
  inviteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  inviteBadgeText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.background,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },

  // Content
  content: {
    flex: 1,
    padding: spacing.xl,
  },
  activityTitle: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xl,
  },

  // Inviter
  inviterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  inviterAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: spacing.lg,
  },
  avatarPlaceholder: {
    backgroundColor: colors.backgroundAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviterInfo: {
    flex: 1,
  },
  inviterLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inviterName: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: colors.text,
  },

  // Details
  detailsContainer: {
    marginBottom: spacing.xl,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  detailText: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
  },

  // Free box
  freeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  freeText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.success,
  },

  // Expiration
  expirationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  expirationText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },

  // Auth screen
  iconCircleLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  authTitle: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  authDescription: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },

  // Error
  errorTitle: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  errorDescription: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },

  // Success
  successTitle: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  successDescription: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Footer
  footer: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  acceptButtonText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.background,
  },
  declineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  declineButtonText: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  primaryButtonText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.background,
  },
  ghostButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  ghostButtonText: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
});
