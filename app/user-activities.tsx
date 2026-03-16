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
  slot_id?: string;
  slot_date?: string;
  slot_time?: string;
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

      // Récupérer les participations avec le slot_id
      const { data: participations, error: partError } = await supabase
        .from('slot_participants')
        .select('activity_id, slot_id')
        .eq('user_id', userId)
        .in('status', ['active', 'completed']);

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
        .in('id', activityIds);

      if (actError) throw actError;

      const activitiesMap = new Map((activitiesData || []).map(a => [a.id, a]));

      // Pour chaque participation, récupérer les infos du slot
      const activitiesWithSlots = await Promise.all(
        participations.map(async (participation) => {
          const activity = activitiesMap.get(participation.activity_id);
          if (!activity) return null;

          let slotDate: string | null = null;
          let slotTime: string | null = null;

          if (participation.slot_id) {
            const { data: slotData } = await supabase
              .from('activity_slots')
              .select('date, time')
              .eq('id', participation.slot_id)
              .single();

            if (slotData) {
              slotDate = slotData.date;
              slotTime = slotData.time;
            }
          }

          return {
            ...activity,
            slot_id: participation.slot_id,
            slot_date: slotDate || activity.date,
            slot_time: slotTime || undefined,
          } as Activity;
        })
      );

      // Filtrer les null et trier par date du slot (plus récent en premier)
      const filtered = activitiesWithSlots
        .filter((a): a is Activity => a !== null)
        .sort((a, b) =>
          new Date(b.slot_date || b.date).getTime() - new Date(a.slot_date || a.date).getTime()
        );

      setActivities(filtered);
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
          <Text style={styles.metaText}>{formatDate(item.slot_date || item.date)}</Text>
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
          keyExtractor={(item) => `${item.id}-${item.slot_id || 'no-slot'}`}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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