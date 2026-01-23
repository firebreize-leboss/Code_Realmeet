// components/IntentionSelector.tsx
// Composant de sélection d'intention réutilisable

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { UserIntention, INTENTION_OPTIONS } from '@/lib/database.types';

interface IntentionSelectorProps {
  selectedIntention: UserIntention;
  onIntentionChange: (intention: UserIntention) => void;
  required?: boolean;
  error?: string;
}

export function IntentionSelector({
  selectedIntention,
  onIntentionChange,
  required = false,
  error,
}: IntentionSelectorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.optionsContainer}>
        {INTENTION_OPTIONS.map((option) => {
          const isSelected = selectedIntention === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionCard,
                isSelected && { borderColor: option.color, backgroundColor: option.color + '15' },
              ]}
              onPress={() => onIntentionChange(option.value as UserIntention)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
                <IconSymbol 
                  name={option.icon as any} 
                  size={24} 
                  color={option.color} 
                />
              </View>
              <Text style={[
                styles.optionLabel,
                isSelected && { color: option.color, fontWeight: '600' },
              ]}>
                {option.label}
              </Text>
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: option.color }]}>
                  <IconSymbol name="checkmark" size={12} color={colors.background} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {required && !selectedIntention && !error && (
        <Text style={styles.helperText}>Choisissez ce que vous recherchez sur RealMeet</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  optionsContainer: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
  },
});