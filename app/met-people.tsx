// app/met-people.tsx
// Écran "Rencontrés" - Liste des personnes croisées lors d'activités TERMINÉES (7 derniers jours)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useDataCache } from '@/contexts/DataCacheContext';

interface MetPerson {
  id: string;
  full_name: string;
  avatar_url?: string;
  city?: string;
  is_friend: boolean;
  request_sent: boolean;
  is_hidden: boolean;
  activities: { name: string; date: string }[];
  last_activity_date: string;
}

export default function MetPeopleScreen() {
  const router = useRouter();
  const { cache } = useDataCache();
  const [people, setPeople] = useState<MetPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [hidingUser, setHidingUser] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Utiliser les amis du cache pour vérifier le statut d'ami
  const friendIds = new Set(cache.friends.map(f => f.friend_id));

  useFocusEffect(
    useCallback(() => {
      loadMetPeople();
    }, [cache.friends]) // Recharger quand la liste d'amis change
  );

  const loadMetPeople = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoading(false);
        return;
      }

      const userId = userData.user.id;
      setCurrentUserId(userId);

      // Calculer la date limite (7 jours en arrière)
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      // Récupérer les créneaux auxquels l'utilisateur a participé dans les 7 derniers jours
      const { data: myParticipations } = await supabase
        .from('slot_participants')
        .select(`
          slot_id,
          activity_id,
          activity_slots!inner (
            id,
            date,
            time
          )
        `)
        .eq('user_id', userId)
        .gte('activity_slots.date', sevenDaysAgoStr)
        .lte('activity_slots.date', todayStr);

      if (!myParticipations || myParticipations.length === 0) {
        setPeople([]);
        setLoading(false);
        return;
      }

      // Filtrer uniquement les créneaux TERMINÉS (date+heure passée)
      const pastSlotIds: string[] = [];
      const slotActivityMap = new Map<string, string>(); // slot_id -> activity_id

      myParticipations.forEach((p: any) => {
        const slotDate = p.activity_slots?.date;
        const slotTime = p.activity_slots?.time || '23:59';
        
        if (slotDate) {
          const slotDateTime = new Date(`${slotDate}T${slotTime}`);
          
          // Seulement si le créneau est PASSÉ
          if (slotDateTime < now) {
            pastSlotIds.push(p.slot_id);
            slotActivityMap.set(p.slot_id, p.activity_id);
          }
        }
      });

      if (pastSlotIds.length === 0) {
        setPeople([]);
        setLoading(false);
        return;
      }

      const activityIds = [...new Set(Array.from(slotActivityMap.values()))];

      // Récupérer les noms des activités
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, nom')
        .in('id', activityIds);

      const activityNames = new Map(activitiesData?.map(a => [a.id, a.nom]) || []);

      // Récupérer les autres participants de ces créneaux PASSÉS uniquement
      const { data: otherParticipants } = await supabase
        .from('slot_participants')
        .select(`
          user_id,
          activity_id,
          slot_id,
          activity_slots!inner (
            date,
            time
          ),
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            city
          )
        `)
        .in('slot_id', pastSlotIds)
        .neq('user_id', userId);

      if (!otherParticipants || otherParticipants.length === 0) {
        setPeople([]);
        setLoading(false);
        return;
      }

      // Récupérer les demandes en attente envoyées
      const { data: requests } = await supabase
        .from('friend_requests')
        .select('receiver_id')
        .eq('sender_id', userId)
        .eq('status', 'pending');

      // Récupérer les personnes masquées (si la table existe)
      let hiddenIds = new Set<string>();
      try {
        const { data: hiddenUsers } = await supabase
          .from('met_people_hidden')
          .select('hidden_user_id')
          .eq('user_id', userId);

        hiddenIds = new Set(hiddenUsers?.map(h => h.hidden_user_id) || []);
      } catch {
        // Table n'existe pas encore, on continue
      }

      // Utiliser les amis du cache (déjà défini plus haut via friendIds)
      const pendingIds = new Set(requests?.map(r => r.receiver_id) || []);

      // Construire la liste des personnes rencontrées (dédupliquées)
      const peopleMap = new Map<string, MetPerson>();
      
      otherParticipants.forEach((p: any) => {
        if (!p.profiles || hiddenIds.has(p.user_id)) return;

        const activityName = activityNames.get(p.activity_id) || 'Activité';
        const activityDate = (p.activity_slots as any)?.date || '';
        
        // Formater la date pour l'affichage
        const formattedDate = activityDate 
          ? new Date(activityDate).toLocaleDateString('fr-FR', { 
              day: 'numeric', 
              month: 'short' 
            })
          : '';

        if (peopleMap.has(p.user_id)) {
          const existing = peopleMap.get(p.user_id)!;
          // Vérifier si cette activité n'est pas déjà listée
          const alreadyHasActivity = existing.activities.some(
            a => a.name === activityName && a.date === formattedDate
          );
          if (!alreadyHasActivity) {
            existing.activities.push({ name: activityName, date: formattedDate });
          }
          // Garder la date la plus récente
          if (activityDate > existing.last_activity_date) {
            existing.last_activity_date = activityDate;
          }
        } else {
          peopleMap.set(p.user_id, {
            id: p.user_id,
            full_name: p.profiles.full_name || 'Utilisateur',
            avatar_url: p.profiles.avatar_url || undefined,
            city: p.profiles.city || undefined,
            is_friend: friendIds.has(p.user_id),
            request_sent: pendingIds.has(p.user_id),
            is_hidden: false,
            activities: [{ name: activityName, date: formattedDate }],
            last_activity_date: activityDate,
          });
        }
      });

      // Trier par date d'activité la plus récente
      const sortedPeople = Array.from(peopleMap.values()).sort(
        (a, b) => b.last_activity_date.localeCompare(a.last_activity_date)
      );

      setPeople(sortedPeople);
    } catch (error) {
      console.error('Erreur chargement personnes rencontrées:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMetPeople();
  };

  const handleSendFriendRequest = async (userId: string) => {
    if (!currentUserId) return;
    
    setSendingRequest(userId);
    try {
      const { error } = await supabase.from('friend_requests').insert({
        sender_id: currentUserId,
        receiver_id: userId,
        status: 'pending',
      });

      if (error && !error.message.toLowerCase().includes('duplicate')) {
        throw error;
      }

      setPeople(prev =>
        prev.map(person =>
          person.id === userId ? { ...person, request_sent: true } : person
        )
      );
    } catch (error) {
      console.error('Erreur envoi demande ami:', error);
      Alert.alert('Erreur', "Impossible d'envoyer la demande d'ami.");
    } finally {
      setSendingRequest(null);
    }
  };

  const handleHideUser = async (userId: string) => {
    if (!currentUserId) return;

    Alert.alert(
      'Masquer ce profil ?',
      'Cette personne ne sera plus affichée dans vos rencontres. Vous pourrez toujours la retrouver via la recherche.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Masquer',
          style: 'destructive',
          onPress: async () => {
            setHidingUser(userId);
            try {
              // Essayer d'insérer dans met_people_hidden
              const { error } = await supabase
                .from('met_people_hidden')
                .insert({
                  user_id: currentUserId,
                  hidden_user_id: userId,
                });

              if (error) {
                // Si la table n'existe pas, on retire juste localement
                console.warn('Table met_people_hidden non disponible:', error.message);
              }

              // Retirer de la liste localement
              setPeople(prev => prev.filter(p => p.id !== userId));
            } catch (error) {
              console.error('Erreur masquage utilisateur:', error);
            } finally {
              setHidingUser(null);
            }
          },
        },
      ]
    );
  };

  const handleViewProfile = (userId: string) => {
    router.push(`/user-profile?id=${userId}`);
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const renderPersonItem = ({ item }: { item: MetPerson }) => (
    <TouchableOpacity
      style={styles.personCard}
      onPress={() => handleViewProfile(item.id)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.avatar_url || 'https://via.placeholder.com/56' }}
        style={styles.avatar}
      />
      
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{item.full_name}</Text>
        
        <View style={styles.activitiesContainer}>
          {item.activities.slice(0, 2).map((activity, index) => (
            <View key={index} style={styles.activityBadge}>
              <IconSymbol name="figure.run" size={12} color={colors.primary} />
              <Text style={styles.activityBadgeText} numberOfLines={1}>
                {activity.name}
              </Text>
              <Text style={styles.activityDateText}>{activity.date}</Text>
            </View>
          ))}
          {item.activities.length > 2 && (
            <Text style={styles.moreActivities}>
              +{item.activities.length - 2} autre{item.activities.length > 3 ? 's' : ''}
            </Text>
          )}
        </View>
        
        <Text style={styles.dateText}>
          Dernière rencontre : {formatRelativeDate(item.last_activity_date)}
        </Text>
      </View>

      <View style={styles.actions}>
        {item.is_friend ? (
          <View style={styles.friendBadge}>
            <IconSymbol name="checkmark" size={14} color={colors.primary} />
            <Text style={styles.friendBadgeText}>Ami</Text>
          </View>
        ) : item.request_sent ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Envoyé</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleSendFriendRequest(item.id)}
            disabled={sendingRequest === item.id}
          >
            {sendingRequest === item.id ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <IconSymbol name="person.badge.plus" size={18} color={colors.background} />
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.hideButton}
          onPress={() => handleHideUser(item.id)}
          disabled={hidingUser === item.id}
        >
          {hidingUser === item.id ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <IconSymbol name="eye.slash" size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconSymbol name="person.2.slash" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>Aucune rencontre récente</Text>
      <Text style={styles.emptySubtitle}>
        Les personnes avec qui vous avez participé à des activités terminées ces 7 derniers jours apparaîtront ici
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => router.push('/(tabs)/browse')}
      >
        <Text style={styles.browseButtonText}>Découvrir des activités</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rencontrés</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.infoBar}>
        <IconSymbol name="clock" size={16} color={colors.textSecondary} />
        <Text style={styles.infoText}>Activités terminées ces 7 derniers jours</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={people}
          renderItem={renderPersonItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContainer,
            people.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
  },
  personInfo: {
    flex: 1,
    gap: 6,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  activitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activityBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
    maxWidth: 80,
  },
  activityDateText: {
    fontSize: 10,
    color: colors.primary + '80',
  },
  moreActivities: {
    fontSize: 11,
    color: colors.textSecondary,
    alignSelf: 'center',
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
  },
  friendBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hideButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});