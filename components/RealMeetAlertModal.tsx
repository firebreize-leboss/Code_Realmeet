// components/RealMeetAlertModal.tsx
// Modal d'alerte brandé RealMeet — remplace les Alert système pour les messages
// importants de l'app (créneau annulé, infos critiques, etc.).

import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol, type IconSymbolName } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

export interface RealMeetAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: IconSymbolName;
  iconTint?: 'primary' | 'danger' | 'info';
  buttonLabel?: string;
  onClose: () => void;
  secondaryButtonLabel?: string;
  onSecondaryPress?: () => void;
}

export function RealMeetAlertModal({
  visible,
  title,
  message,
  icon = 'exclamationmark.circle.fill',
  iconTint = 'primary',
  buttonLabel = 'Compris',
  onClose,
  secondaryButtonLabel,
  onSecondaryPress,
}: RealMeetAlertModalProps) {
  const tintColor =
    iconTint === 'danger' ? '#EF4444' : iconTint === 'info' ? '#3B82F6' : colors.primary;
  const tintBg =
    iconTint === 'danger'
      ? 'rgba(239, 68, 68, 0.1)'
      : iconTint === 'info'
        ? 'rgba(59, 130, 246, 0.1)'
        : colors.primaryLight;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Brand header */}
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandLabel}>RealMeet</Text>
          </View>

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: tintBg }]}>
            <IconSymbol name={icon} size={30} color={tintColor} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* CTA principal */}
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.buttonWrapper}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* CTA secondaire optionnel */}
          {secondaryButtonLabel && onSecondaryPress && (
            <TouchableOpacity
              onPress={onSecondaryPress}
              activeOpacity={0.7}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{secondaryButtonLabel}</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  brandLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.8,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonWrapper: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
  },
});
