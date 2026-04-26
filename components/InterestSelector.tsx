import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors, spacing, borderRadius } from '@/styles/commonStyles';

interface InterestSelectorProps {
  selectedInterests: string[];
  onInterestsChange: (interests: string[]) => void;
  maxSelection?: number;
}

const ALL_INTERESTS = [
  'Sport', 'Musique', 'Cinéma', 'Lecture', 'Voyage',
  'Cuisine', 'Photographie', 'Dessin', 'Danse', 'Gaming',
  'Technologie', 'Mode', 'Art', 'Fitness', 'Yoga',
  'Randonnée', 'Natation', 'Football', 'Basketball', 'Tennis',
  'Guitare', 'Piano', 'Chant', 'Théâtre', 'Écriture',
  'Jardinage', 'Peinture', 'Sculpture', 'Astronomie', 'Science',
  'Histoire', 'Langues',
];

export const InterestSelector: React.FC<InterestSelectorProps> = ({
  selectedInterests,
  onInterestsChange,
  maxSelection = 5,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      onInterestsChange(selectedInterests.filter((i) => i !== interest));
    } else if (selectedInterests.length < maxSelection) {
      // Dédupliquer par sécurité
      const updated = [...selectedInterests, interest];
      onInterestsChange([...new Set(updated)]);
    }
  };

  const filteredInterests = useMemo(() => {
    if (!search.trim()) return ALL_INTERESTS;
    const q = search.trim().toLowerCase();
    return ALL_INTERESTS.filter((i) => i.toLowerCase().includes(q));
  }, [search]);

  const openPicker = () => {
    setSearch('');
    setModalVisible(true);
  };

  return (
    <View>
      {/* Chips sélectionnées + bouton ajouter */}
      <View style={styles.selectedRow}>
        {selectedInterests.map((interest) => (
          <TouchableOpacity
            key={interest}
            onPress={() => toggleInterest(interest)}
            activeOpacity={0.7}
            style={styles.selectedChip}
          >
            <Text style={styles.selectedChipText}>{interest}</Text>
            <IconSymbol name="xmark" size={11} color={colors.primary} />
          </TouchableOpacity>
        ))}

        {selectedInterests.length < maxSelection && (
          <TouchableOpacity
            onPress={openPicker}
            activeOpacity={0.7}
            style={styles.addChip}
          >
            <IconSymbol name="plus" size={13} color={colors.textSecondary} />
            <Text style={styles.addChipText}>
              {selectedInterests.length === 0 ? 'Ajouter' : 'Ajouter'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.counter}>
        {selectedInterests.length} / {maxSelection}
      </Text>

      {/* Modal picker */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Centres d'intérêt</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetSubtitle}>
              Sélectionnez jusqu'à {maxSelection} centres d'intérêt
            </Text>

            {/* Search */}
            <View style={styles.searchContainer}>
              <IconSymbol name="magnifyingglass" size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
            </View>

            {/* Grid */}
            <ScrollView
              style={styles.grid}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.chipsWrap}>
                {filteredInterests.map((interest) => {
                  const isSelected = selectedInterests.includes(interest);
                  const isDisabled = !isSelected && selectedInterests.length >= maxSelection;
                  return (
                    <TouchableOpacity
                      key={interest}
                      onPress={() => toggleInterest(interest)}
                      disabled={isDisabled}
                      activeOpacity={0.7}
                      style={[
                        styles.pickerChip,
                        isSelected && styles.pickerChipSelected,
                        isDisabled && styles.pickerChipDisabled,
                      ]}
                    >
                      {isSelected && (
                        <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
                      )}
                      <Text
                        style={[
                          styles.pickerChipText,
                          isSelected && styles.pickerChipTextSelected,
                          isDisabled && styles.pickerChipTextDisabled,
                        ]}
                      >
                        {interest}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Footer */}
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              activeOpacity={0.85}
              style={styles.doneButton}
            >
              <Text style={styles.doneButtonText}>Valider</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  selectedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(242, 153, 74, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  selectedChipText: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  addChipText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
  counter: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },

  // Modal
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '78%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
  },
  sheetSubtitle: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
    marginBottom: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.backgroundAccent,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    padding: 0,
  },
  grid: {
    flexGrow: 0,
  },
  gridContent: {
    paddingBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.backgroundAccent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerChipDisabled: {
    opacity: 0.4,
  },
  pickerChipText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  pickerChipTextSelected: {
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  pickerChipTextDisabled: {
    color: colors.textTertiary,
  },
  doneButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
});
