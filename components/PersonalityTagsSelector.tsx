// components/PersonalityTagsSelector.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';

interface PersonalityTagsSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  maxSelection?: number;
}

// Liste des tags de personnalité / ambiance
export const ALL_PERSONALITY_TAGS = [
  // Énergie sociale
  "Calme",
  "Festif",
  "Énergique",
  "Détendu",
  "Dynamique",
  
  // Sociabilité
  "Introverti",
  "Extraverti",
  "Sociable",
  "Réservé",
  "Ouvert",
  
  // Ambiance recherchée
  "Aventurier",
  "Casanier",
  "Curieux",
  "Spontané",
  "Organisé",
  
  // Style de communication
  "Bavard",
  "Bon écouteur",
  "Humoristique",
  "Sérieux",
  "Créatif",
  
  // Préférences sociales
  "Petit groupe",
  "Grande fête",
  "Tête-à-tête",
  "Networking",
  "Chill",
];

export const PersonalityTagsSelector: React.FC<PersonalityTagsSelectorProps> = ({
  selectedTags,
  onTagsChange,
  maxSelection = 5,
}) => {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      // Désélectionner
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else if (selectedTags.length < maxSelection) {
      // Sélectionner
      onTagsChange([...selectedTags, tag]);
    } else {
      // Max atteint - afficher toast
      Alert.alert(
        'Maximum atteint',
        `Vous ne pouvez sélectionner que ${maxSelection} tags maximum. Désélectionnez-en un pour en choisir un autre.`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Compteur */}
      <View style={styles.counterSection}>
        <Text style={styles.counterLabel}>
          Décrivez votre personnalité (max {maxSelection})
        </Text>
        <Text style={[
          styles.counterValue,
          selectedTags.length >= maxSelection && styles.counterValueMax
        ]}>
          {selectedTags.length} / {maxSelection}
        </Text>
      </View>

      {/* Tags sélectionnés */}
      {selectedTags.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedTitle}>Ma personnalité</Text>
          <View style={styles.selectedContainer}>
            {selectedTags.map((tag) => (
              <View key={tag} style={styles.selectedBadge}>
                <Text style={styles.selectedText}>{tag}</Text>
                <TouchableOpacity onPress={() => toggleTag(tag)}>
                  <IconSymbol name="xmark" size={14} color={colors.background} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Grille de tous les tags */}
      <View style={styles.grid}>
        {ALL_PERSONALITY_TAGS.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          const isDisabled = !isSelected && selectedTags.length >= maxSelection;

          return (
            <TouchableOpacity
              key={tag}
              onPress={() => toggleTag(tag)}
              disabled={isDisabled}
              style={[
                styles.tagButton,
                isSelected && styles.tagButtonSelected,
                isDisabled && styles.tagButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  isSelected && styles.tagTextSelected,
                  isDisabled && styles.tagTextDisabled,
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  counterSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  counterLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  counterValueMax: {
    color: '#F59E0B',
  },
  selectedSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  selectedTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 12,
  },
  selectedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  selectedText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.background,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  tagButton: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagButtonSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  tagButtonDisabled: {
    backgroundColor: colors.card,
    opacity: 0.4,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  tagTextSelected: {
    color: colors.background,
  },
  tagTextDisabled: {
    color: colors.textSecondary,
  },
});

export default PersonalityTagsSelector;