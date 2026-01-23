import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';

interface InterestSelectorProps {
  selectedInterests: string[];
  onInterestsChange: (interests: string[]) => void;
  maxSelection?: number;
}

const ALL_INTERESTS = [
  "Sport", "Musique", "Cinéma", "Lecture", "Voyage",
  "Cuisine", "Photographie", "Dessin", "Danse", "Gaming",
  "Technologie", "Mode", "Art", "Fitness", "Yoga",
  "Randonnée", "Natation", "Football", "Basketball", "Tennis",
  "Guitare", "Piano", "Chant", "Théâtre", "Écriture",
  "Jardinage", "Peinture", "Sculpture", "Astronomie", "Science",
  "Histoire", "Langues"
];

export const InterestSelector: React.FC<InterestSelectorProps> = ({
  selectedInterests,
  onInterestsChange,
  maxSelection = 5,
}) => {
  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      onInterestsChange(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < maxSelection) {
      onInterestsChange([...selectedInterests, interest]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Compteur */}
      <View style={styles.counterSection}>
        <Text style={styles.counterLabel}>
          Sélectionnez jusqu'à {maxSelection} centres d'intérêts
        </Text>
        <Text style={styles.counterValue}>
          {selectedInterests.length} / {maxSelection}
        </Text>
      </View>

      {/* Centres d'intérêts sélectionnés */}
      {selectedInterests.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedTitle}>Mes centres d'intérêts</Text>
          <View style={styles.selectedContainer}>
            {selectedInterests.map((interest) => (
              <View key={interest} style={styles.selectedBadge}>
                <Text style={styles.selectedText}>{interest}</Text>
                <TouchableOpacity onPress={() => toggleInterest(interest)}>
                  <IconSymbol name="xmark" size={14} color={colors.background} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Grille de tous les centres d'intérêts */}
      <View style={styles.grid}>
        {ALL_INTERESTS.map((interest) => {
          const isSelected = selectedInterests.includes(interest);
          const isDisabled = !isSelected && selectedInterests.length >= maxSelection;

          return (
            <TouchableOpacity
              key={interest}
              onPress={() => toggleInterest(interest)}
              disabled={isDisabled}
              style={[
                styles.interestButton,
                isSelected && styles.interestButtonSelected,
                isDisabled && styles.interestButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.interestText,
                  isSelected && styles.interestTextSelected,
                  isDisabled && styles.interestTextDisabled,
                ]}
              >
                {interest}
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
    backgroundColor: colors.primary,
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
  interestButton: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexBasis: '30%',
    flexGrow: 0,
    alignItems: 'center',
  },
  interestButtonSelected: {
    backgroundColor: colors.primary,
  },
  interestButtonDisabled: {
    backgroundColor: colors.card,
    opacity: 0.4,
  },
  interestText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  interestTextSelected: {
    color: colors.background,
  },
  interestTextDisabled: {
    color: colors.textSecondary,
  },
});