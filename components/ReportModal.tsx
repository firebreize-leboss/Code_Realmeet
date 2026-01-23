// components/ReportModal.tsx
// Modal de signalement réutilisable pour profils, messages et activités

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import {
  reportService,
  ReportTargetType,
  ReportReason,
  REPORT_REASONS,
  TARGET_TYPE_LABELS,
} from '@/services/report.service';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetName?: string; // Nom optionnel pour personnaliser le message
}

export default function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
  targetName,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Réinitialiser le formulaire
  const resetForm = () => {
    setSelectedReason(null);
    setDescription('');
    setIsSubmitting(false);
  };

  // Fermer la modal
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Soumettre le signalement
  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Erreur', 'Veuillez sélectionner une raison de signalement.');
      return;
    }

    // Confirmation avant envoi
    Alert.alert(
      'Confirmer le signalement',
      `Êtes-vous sûr de vouloir signaler ${targetName || TARGET_TYPE_LABELS[targetType]} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Signaler',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);

            const result = await reportService.createReport({
              targetType,
              targetId,
              reason: selectedReason,
              description: description.trim() || undefined,
            });

            setIsSubmitting(false);

            if (result.success) {
              Alert.alert(
                'Signalement envoyé',
                'Merci pour votre signalement. Notre équipe va l\'examiner rapidement.',
                [{ text: 'OK', onPress: handleClose }]
              );
            } else if (result.isDuplicate) {
              Alert.alert(
                'Déjà signalé',
                'Vous avez déjà signalé cet élément. Notre équipe examine votre signalement.',
                [{ text: 'OK', onPress: handleClose }]
              );
            } else {
              Alert.alert('Erreur', result.error || 'Une erreur est survenue.');
            }
          },
        },
      ]
    );
  };

  // Titre dynamique selon le type de cible
  const getTitle = (): string => {
    switch (targetType) {
      case 'profile':
        return 'Signaler ce profil';
      case 'message':
        return 'Signaler ce message';
      case 'activity':
        return 'Signaler cette activité';
      default:
        return 'Signaler';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{getTitle()}</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Info */}
            <View style={styles.infoBox}>
              <IconSymbol name="info.circle.fill" size={20} color={colors.secondary} />
              <Text style={styles.infoText}>
                Votre signalement sera traité de manière confidentielle par notre équipe de modération.
              </Text>
            </View>

            {/* Raisons */}
            <Text style={styles.sectionTitle}>Quelle est la raison du signalement ?</Text>
            <View style={styles.reasonsContainer}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={[
                    styles.reasonOption,
                    selectedReason === reason.value && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.value)}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name={reason.icon as any}
                    size={22}
                    color={selectedReason === reason.value ? colors.error : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason.value && styles.reasonTextSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  {selectedReason === reason.value && (
                    <IconSymbol name="checkmark.circle.fill" size={20} color={colors.error} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Description optionnelle */}
            <Text style={styles.sectionTitle}>
              Détails supplémentaires <Text style={styles.optionalLabel}>(optionnel)</Text>
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Décrivez le problème en détail..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            {/* Bouton Soumettre */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <IconSymbol name="flag.fill" size={20} color={colors.background} />
                  <Text style={styles.submitButtonText}>Envoyer le signalement</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Espace pour le keyboard */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.secondary + '15',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  optionalLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  reasonsContainer: {
    gap: 8,
    marginBottom: 24,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonOptionSelected: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  reasonTextSelected: {
    color: colors.error,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 24,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});