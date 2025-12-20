// components/PersonalityTagsBadges.tsx
// Composant d'affichage des tags de personnalité (non interactif)
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { colors } from '@/styles/commonStyles';

interface PersonalityTagsBadgesProps {
  tags: string[];
  size?: 'small' | 'medium';
}

export const PersonalityTagsBadges: React.FC<PersonalityTagsBadgesProps> = ({
  tags,
  size = 'medium',
}) => {
  if (!tags || tags.length === 0) {
    return null;
  }

  const isSmall = size === 'small';

  return (
    <View style={styles.container}>
      {tags.map((tag, index) => (
        <View 
          key={index} 
          style={[
            styles.badge,
            isSmall && styles.badgeSmall,
          ]}
        >
          <Text style={[
            styles.badgeText,
            isSmall && styles.badgeTextSmall,
          ]}>
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#8B5CF640',
  },
  badgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  badgeTextSmall: {
    fontSize: 12,
  },
});

export default PersonalityTagsBadges;