// components/LeaveReviewModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import RatingStars from '@/components/RatingStars';
import { supabase } from '@/lib/supabase';

interface LeaveReviewModalProps {
  visible: boolean;
  onClose: () => void;
  activityId: string;
  activityTitle: string;
  onReviewSubmitted?: () => void;
}

export default function LeaveReviewModal({
  visible,
  onClose,
  activityId,
  activityTitle,
  onReviewSubmitted,
}: LeaveReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Note requise', 'Veuillez attribuer une note entre 1 et 5 étoiles.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('submit_review', {
        p_activity_id: activityId,
        p_rating: rating,
        p_comment: comment.trim() || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        const errorMessages: Record<string, string> = {
          not_participant: "Vous n'avez pas participé à cette activité.",
          activity_not_past: "Vous pourrez noter cette activité une fois terminée.",
          already_reviewed: 'Vous avez déjà noté cette activité.',
          cannot_review_own: 'Vous ne pouvez pas noter votre propre activité.',
          non_authenticated: 'Vous devez être connecté.',
        };
        Alert.alert('Impossible', errorMessages[result.error || ''] || 'Une erreur est survenue.');
        return;
      }

      Alert.alert('Merci !', 'Votre avis a été enregistré avec succès.', [
        {
          text: 'OK',
          onPress: () => {
            setRating(0);
            setComment('');
            onClose();
            onReviewSubmitted?.();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Erreur soumission avis:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la soumission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    onClose();
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Donner un avis</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.activityTitle} numberOfLines={2}>
              {activityTitle}
            </Text>

            <View style={styles.ratingSection}>
              <Text style={styles.sectionLabel}>Votre note</Text>
              <View style={styles.starsContainer}>
                <RatingStars
                  rating={rating}
                  size={40}
                  interactive
                  onRatingChange={setRating}
                />
              </View>
              <Text style={styles.ratingHint}>
                {rating === 0
                  ? 'Appuyez sur les étoiles pour noter'
                  : rating === 1
                  ? 'Très décevant'
                  : rating === 2
                  ? 'Décevant'
                  : rating === 3
                  ? 'Correct'
                  : rating === 4
                  ? 'Bien'
                  : 'Excellent !'}
              </Text>
            </View>

            <View style={styles.commentSection}>
              <Text style={styles.sectionLabel}>
                Votre commentaire <Text style={styles.optionalLabel}>(optionnel)</Text>
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Partagez votre expérience..."
                placeholderTextColor={colors.textSecondary}
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{comment.length}/500</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (rating === 0 || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <IconSymbol name="star.fill" size={20} color={colors.background} />
                  <Text style={styles.submitButtonText}>Publier mon avis</Text>
                </>
              )}
            </TouchableOpacity>

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
    maxHeight: '80%',
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
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionLabel: {
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
  starsContainer: {
    marginVertical: 16,
  },
  ratingHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  commentSection: {
    marginBottom: 24,
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
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
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