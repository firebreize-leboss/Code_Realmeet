// app/(tabs)/business-groups.tsx
// Vue des groupes liés aux activités de l'entreprise (lecture seule)

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

interface ActivityGroup {
  id: string;
  conversationId: string;
  activityName: string;
  activityImage: string;
  slotDate: string;
  slotTime: string;
  participantCount: number;
  maxParticipants: number;
  lastMessage: string;
  lastMessageTime: string;
  slotDateTime: Date;
  isOngoing: boolean;
}

export default function BusinessGroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'finished'>('ongoing');

  const loadGroups = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('id, nom, image_url, max_participants')
        .eq('host_id', userData.user.id);

      if (activitiesError) throw activitiesError;

      if (!activities || activities.length === 0) {
        setGroups([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const activityIds = activities.map(a => a.id);

      const { data: slots, error: slotsError } = await supabase
        .from('activity_slots')
        .select('id, activity_id, date, time')
        .in('activity_id', activityIds);

      if (slotsError) throw slotsError;

      if (!slots || slots.length === 0) {
        setGroups([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const slotIds = slots.map(s => s.id);

      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, slot_id, name, image_url, updated_at')
        .in('slot_id', slotIds)
        .eq('is_group', true);

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        setGroups([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const groupsData: ActivityGroup[] = [];

      for (const conv of conversations) {
        const slot = slots.find(s => s.id === conv.slot_id);
        if (!slot) continue;

        const activity = activities.find(a => a.id === slot.activity_id);
        if (!activity) continue;

        const slotDateTime = new Date(`${slot.date}T${slot.time || '23:59'}`);
        const isOngoing = slotDateTime >= new Date();

        const { count: participantCount } = await supabase
          .from('conversation_participants')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, message_type, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let lastMessageText = 'Aucun message';
        if (lastMsg) {
          if (lastMsg.message_type === 'voice') lastMessageText = 'Message vocal';
          else if (lastMsg.message_type === 'image') lastMessageText = 'Image';
          else if (lastMsg.message_type === 'system') lastMessageText = `${lastMsg.content}`;
          else lastMessageText = lastMsg.content || '';
        }

        const formatTime = (timeStr: string) => {
          if (!timeStr) return '';
          const now = new Date();
          const msgDate = new Date(timeStr);
          const diffMs = now.getTime() - msgDate.getTime();
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

          if (diffHours < 1) return 'À l\'instant';
          if (diffHours < 24) return `Il y a ${diffHours}h`;
          const diffDays = Math.floor(diffHours / 24);
          if (diffDays === 1) return 'Hier';
          return `Il y a ${diffDays}j`;
        };

        groupsData.push({
          id: conv.id,
          conversationId: conv.id,
          activityName: activity.nom,
          activityImage: activity.image_url,
          slotDate: new Date(slot.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          slotTime: slot.time,
          participantCount: participantCount || 0,
          maxParticipants: activity.max_participants,
          lastMessage: lastMsg?.content || 'Aucun message',
          lastMessageTime: lastMsg ? formatTime(lastMsg.created_at) : '',
          slotDateTime,
          isOngoing,
        });
      }

      setGroups(groupsData);
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  const handleGroupPress = (group: ActivityGroup) => {
    router.push(`/business-group-view?id=${group.conversationId}&name=${encodeURIComponent(group.activityName)}`);
  };

  const renderGroupItem = ({ item }: { item: ActivityGroup }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => handleGroupPress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.activityImage || 'https://via.placeholder.com/60' }}
        style={styles.groupImage}
      />

      <View style={styles.groupContent}>
        <View style={styles.groupHeader}>
          <Text style={styles.activityName} numberOfLines={1}>{item.activityName}</Text>
          <Text style={styles.lastTime}>{item.lastMessageTime}</Text>
        </View>

        <View style={styles.slotInfo}>
          <IconSymbol name="calendar" size={12} color="rgba(255,255,255,0.8)" />
          <Text style={styles.slotText}>{item.slotDate} à {item.slotTime}</Text>
        </View>

        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>

        <View style={styles.participantsRow}>
          <IconSymbol name="person.2.fill" size={14} color="#FFFFFF" />
          <Text style={styles.participantsText}>
            {item.participantCount}/{item.maxParticipants} participants
          </Text>
        </View>
      </View>

      <View style={[styles.viewIndicator, !item.isOngoing && styles.viewIndicatorClosed]}>
        <IconSymbol
          name={item.isOngoing ? "message.fill" : "lock.fill"}
          size={16}
          color={item.isOngoing ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
        />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Chargement des groupes...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Groupes d'activités</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ongoing' && styles.tabActive]}
            onPress={() => setActiveTab('ongoing')}
          >
            <Text style={[styles.tabText, activeTab === 'ongoing' && styles.tabTextActive]}>
              En cours
            </Text>
            <View style={[styles.tabBadge, activeTab === 'ongoing' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'ongoing' && styles.tabBadgeTextActive]}>
                {groups.filter(g => g.isOngoing).length}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'finished' && styles.tabActive]}
            onPress={() => setActiveTab('finished')}
          >
            <Text style={[styles.tabText, activeTab === 'finished' && styles.tabTextActive]}>
              Terminées
            </Text>
            <View style={[styles.tabBadge, activeTab === 'finished' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'finished' && styles.tabBadgeTextActive]}>
                {groups.filter(g => !g.isOngoing).length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="person.3.fill" size={64} color="rgba(255,255,255,0.7)" />
            <Text style={styles.emptyTitle}>Aucun groupe actif</Text>
            <Text style={styles.emptyText}>
              Les groupes apparaîtront lorsque des participants s'inscriront à vos activités
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/create-activity')}
            >
              <IconSymbol name="plus.circle.fill" size={20} color="#818CF8" />
              <Text style={styles.createButtonText}>Créer une activité</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={groups.filter(g => activeTab === 'ongoing' ? g.isOngoing : !g.isOngoing)}
            renderItem={renderGroupItem}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.listContent,
              Platform.OS !== 'ios' && styles.listContentWithTabBar,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFFFFF"
              />
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  listContentWithTabBar: {
    paddingBottom: 100,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  groupImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  groupContent: {
    flex: 1,
    gap: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  lastTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  lastMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  participantsText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  viewIndicator: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#818CF8',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  viewIndicatorClosed: {
    opacity: 0.5,
  },
});
