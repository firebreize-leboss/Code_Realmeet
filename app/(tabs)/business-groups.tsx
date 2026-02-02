// app/(tabs)/business-groups.tsx
// Vue des groupes liés aux activités de l'entreprise (lecture seule)
// Premium Clean Design - White/Gray with Orange accent

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
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

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
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
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
      activeOpacity={0.7}
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
          <IconSymbol name="calendar" size={12} color="#9CA3AF" />
          <Text style={styles.slotText}>{item.slotDate} à {item.slotTime}</Text>
        </View>

        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>

        <View style={styles.participantsRow}>
          <IconSymbol name="person.2.fill" size={12} color={colors.primary} />
          <Text style={styles.participantsText}>
            {item.participantCount}/{item.maxParticipants}
          </Text>
        </View>
      </View>

      <View style={[styles.statusIndicator, !item.isOngoing && styles.statusIndicatorClosed]}>
        <IconSymbol
          name={item.isOngoing ? "message.fill" : "lock.fill"}
          size={14}
          color={item.isOngoing ? colors.primary : "#9CA3AF"}
        />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Groupes d'activités</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement des groupes...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const ongoingGroups = groups.filter(g => g.isOngoing);
  const finishedGroups = groups.filter(g => !g.isOngoing);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Groupes d'activités</Text>
        </View>

        {/* Tab Selector */}
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
                {ongoingGroups.length}
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
                {finishedGroups.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <IconSymbol name="person.3.fill" size={48} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>Aucun groupe actif</Text>
            <Text style={styles.emptyText}>
              Les groupes apparaîtront lorsque des participants s'inscriront à vos activités
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/create-activity')}
              activeOpacity={0.8}
            >
              <IconSymbol name="plus" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Créer une activité</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={activeTab === 'ongoing' ? ongoingGroups : finishedGroups}
            renderItem={renderGroupItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyTabState}>
                <IconSymbol
                  name={activeTab === 'ongoing' ? "calendar.badge.clock" : "checkmark.circle"}
                  size={40}
                  color="#D1D5DB"
                />
                <Text style={styles.emptyTabText}>
                  {activeTab === 'ongoing'
                    ? "Aucun groupe en cours"
                    : "Aucun groupe terminé"}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: '#6B7280',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    gap: 8,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  tabBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: colors.primary,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#6B7280',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  itemSeparator: {
    height: 8,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  groupImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  groupContent: {
    flex: 1,
    gap: 3,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#1F2937',
    marginRight: 8,
  },
  lastTime: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: '#9CA3AF',
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotText: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: '#9CA3AF',
  },
  lastMessage: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: '#6B7280',
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  participantsText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  statusIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicatorClosed: {
    backgroundColor: '#F2F2F7',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  emptyTabState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTabText: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: '#9CA3AF',
  },
});
