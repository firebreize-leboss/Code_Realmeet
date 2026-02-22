import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { invitationService, PlusOneInvitation } from '@/services/invitation.service';

interface InvitePlusOneModalProps {
  visible: boolean;
  onClose: () => void;
  slotId: string;
  activityName: string;
  onInvitationCreated?: () => void;
}

export default function InvitePlusOneModal({
  visible,
  onClose,
  slotId,
  activityName,
  onInvitationCreated,
}: InvitePlusOneModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [invitation, setInvitation] = useState<PlusOneInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      loadOrCreateInvitation();
    } else {
      setInvitation(null);
      setError(null);
      setCopied(false);
    }
  }, [visible, slotId]);

  const loadOrCreateInvitation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Vérifier si une invitation existe déjà
      const existingResult = await invitationService.getMyPendingInvitation(slotId);

      if (existingResult.success && existingResult.invitation) {
        setInvitation(existingResult.invitation);
        setIsLoading(false);
        return;
      }

      // Créer une nouvelle invitation
      const result = await invitationService.createInvitation(slotId);

      if (!result.success) {
        setError(result.error || 'Erreur lors de la création');
        setIsLoading(false);
        return;
      }

      // Recharger l'invitation créée
      const reloadResult = await invitationService.getMyPendingInvitation(slotId);
      if (reloadResult.success && reloadResult.invitation) {
        setInvitation(reloadResult.invitation);
        onInvitationCreated?.();
      }
    } catch (err: any) {
      setError(err.message || 'Erreur inattendue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitation) return;

    try {
      const link = invitationService.generateShareLink(invitation.token);
      await Clipboard.setStringAsync(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de copier le lien');
    }
  };

  const handleShare = async () => {
    if (!invitation) return;

    setIsSharing(true);
    try {
      await invitationService.shareInvitation(invitation.token, activityName);
    } catch (err) {
      // Partage annulé ou erreur, on ne fait rien
    } finally {
      setIsSharing(false);
    }
  };

  const handleCancelInvitation = async () => {
    if (!invitation) return;

    Alert.alert(
      'Annuler l\'invitation',
      'Êtes-vous sûr de vouloir annuler cette invitation ? Le lien ne sera plus valide.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            const result = await invitationService.cancelInvitation(invitation.id);
            setIsLoading(false);

            if (result.success) {
              onClose();
            } else {
              Alert.alert('Erreur', result.error || 'Impossible d\'annuler');
            }
          },
        },
      ]
    );
  };

  const formatExpirationTime = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}min`;
    }
    return `${diffMinutes} minutes`;
  };

  const truncateLink = (token: string) => {
    const link = invitationService.generateShareLink(token);
    if (link.length > 35) {
      return link.substring(0, 32) + '...';
    }
    return link;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Inviter un +1</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Préparation du lien...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadOrCreateInvitation}>
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : invitation ? (
              <>
                <View style={styles.iconContainer}>
                  <View style={styles.iconCircle}>
                    <IconSymbol name="person.badge.plus" size={32} color={colors.primary} />
                  </View>
                </View>

                <Text style={styles.description}>
                  Partage ce lien avec un ami pour qu'il te rejoigne sur cette activité.
                </Text>

                <View style={styles.linkContainer}>
                  <Text style={styles.linkLabel}>Lien d'invitation</Text>
                  <View style={styles.linkBox}>
                    <Text style={styles.linkText} numberOfLines={1}>
                      {truncateLink(invitation.token)}
                    </Text>
                    <TouchableOpacity onPress={handleCopyLink} style={styles.copyButton}>
                      <IconSymbol
                        name={copied ? 'checkmark' : 'doc.on.doc'}
                        size={20}
                        color={copied ? colors.success : colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                  {copied && <Text style={styles.copiedText}>Lien copié !</Text>}
                </View>

                <View style={styles.infoBox}>
                  <IconSymbol name="clock" size={16} color={colors.textSecondary} />
                  <Text style={styles.infoText}>
                    Ce lien expire dans {formatExpirationTime(invitation.expiresAt)}
                  </Text>
                </View>

                <View style={styles.infoBox}>
                  <IconSymbol name="gift" size={16} color={colors.success} />
                  <Text style={styles.infoText}>
                    Ton ami pourra rejoindre gratuitement
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                  disabled={isSharing}
                  activeOpacity={0.8}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <>
                      <IconSymbol name="square.and.arrow.up" size={20} color={colors.background} />
                      <Text style={styles.shareButtonText}>Partager le lien</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelInvitation}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Annuler l'invitation</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  errorText: {
    marginTop: spacing.lg,
    fontSize: typography.base,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.background,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  linkContainer: {
    marginBottom: spacing.xl,
  },
  linkLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: spacing.sm,
  },
  copiedText: {
    marginTop: spacing.xs,
    fontSize: typography.sm,
    color: colors.success,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAccent,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  shareButtonText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.background,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  cancelButtonText: {
    fontSize: typography.sm,
    color: colors.error,
    fontWeight: '500',
  },
});
