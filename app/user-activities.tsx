// app/user-activities.tsx
// Liste des activités auxquelles un utilisateur a participé

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

interface Activity {
  id: string;
  nom: string;
  image_url: string;
  date: string;
  ville: string;
  categorie: string;
}

export default function UserActivitiesScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [id]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const userId = id as string;

      // Récupérer les participations de l'utilisateur
      const { data: participations, error: partError } = await supabase
        .from('slot_participants')
        .select('activity_id, activity_slots(date)')
        .eq('user_id', userId);

      if (partError) throw partError;

      if (!participations || participations.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      const activityIds = [...new Set(participations.map(p => p.activity_id))];

      // Récupérer les détails des activités
      const { data: activitiesData, error: actError } = await supabase
        .from('activities')
        .select('id, nom, image_url, date, ville, categorie')
        .in('id', activityIds)
        .order('date', { ascending: false });

      if (actError) throw actError;

      setActivities(activitiesData || []);
    } catch (error) {
      console.error('Erreur chargement activités:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => router.push(`/activity-detail?id=${item.id}`)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.image_url || 'https://via.placeholder.com/80' }}
        style={styles.activityImage}
      />
      <View style={styles.activityInfo}>
        <Text style={styles.activityName} numberOfLines={2}>{item.nom}</Text>
        <View style={styles.activityMeta}>
          <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.activityMeta}>
          <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{item.ville}</Text>
        </View>
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {name ? `Activités de ${decodeURIComponent(name as string)}` : 'Activités'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="figure.run" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Aucune activité</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  activityImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  activityInfo: {
    flex: 1,
    gap: 4,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});