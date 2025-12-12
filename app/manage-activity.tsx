// app/manage-activity.tsx
// Page de gestion d'une activité pour les entreprises

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import ActivityCalendar from '@/components/ActivityCalendar';
import { Modal } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


interface ActivityStats {
  id: string;
  title: string;
  image: string;
  category: string;
  totalParticipants: number;
  maxParticipants: number;
  totalRevenue: number;
  averageRating: number;
  reviewCount: number;
  status: 'active' | 'paused' | 'ended';
  createdAt: string;
  slots: SlotStats[];
}

interface SlotStats {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  participants: number;
  maxParticipants: number;
  hasGroup: boolean;
  groupId?: string;
}

interface Participant {
  id: string;
  name: string;
  avatar: string;
  joinedAt: string;
  slotDate: string;
}

export default function ManageActivityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'slots'>('overview');
  const [showSlotModal, setShowSlotModal] = useState(false);

  useEffect(() => {
    loadActivityData();
  }, [id]);

  const loadActivityData = async () => {
    try {
      const activityId = id as string;

      // Charger les détails de l'activité
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();

      if (activityError) throw activityError;

      // Charger les créneaux
      const { data: slotsData } = await supabase
        .from('activity_slots')
        .select('*')
        .eq('activity_id', activityId)
        .order('date', { ascending: true });

      // Charger les participants via slot_participants
      const { data: participantsData } = await supabase
        .from('slot_participants')
        .select(`
          id,
          user_id,
          slot_id,
          created_at,
          profiles:user_id (
            full_name,
            avatar_url
          ),
          activity_slots:slot_id (
            date
          )
        `)
        .eq('activity_id', activityId);

      // Charger les conversations de groupe
      const slotIds = slotsData?.map(s => s.id) || [];
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, slot_id')
        .in('slot_id', slotIds);

      const convMap = new Map(conversations?.map(c => [c.slot_id, c.id]) || []);

      // Construire les stats des créneaux
      const slots: SlotStats[] = (slotsData || []).map(slot => {
        const slotParticipants = participantsData?.filter(p => p.slot_id === slot.id) || [];
        return {
          id: slot.id,
          date: new Date(slot.date).toLocaleDateString('fr-FR', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
          }),
          timeStart: slot.time_start?.slice(0, 5) || '',
          timeEnd: slot.time_end?.slice(0, 5) || '',
          participants: slotParticipants.length,
          maxParticipants: activityData.max_participants,
          hasGroup: convMap.has(slot.id),
          groupId: convMap.get(slot.id),
        };
      });

      // Calculer le total des participants
      const totalParticipants = participantsData?.length || 0;

      // Calculer le revenu total
      const totalRevenue = totalParticipants * (activityData.prix || 0);

      setActivity({
        id: activityData.id,
        title: activityData.nom || activityData.titre,
        image: activityData.image_url || '',
        category: activityData.categorie || '',
        totalParticipants,
        maxParticipants: activityData.max_participants,
        totalRevenue,
        averageRating: 0, // À implémenter avec un système d'avis
        reviewCount: 0,
        status: activityData.status || 'active',
        createdAt: activityData.created_at,
        slots,
      });

      // Formater les participants
      const formattedParticipants: Participant[] = (participantsData || []).map((p: any) => ({
        id: p.user_id,
        name: p.profiles?.full_name || 'Participant',
        avatar: p.profiles?.avatar_url || '',
        joinedAt: new Date(p.created_at).toLocaleDateString('fr-FR'),
        slotDate: p.activity_slots?.date 
          ? new Date(p.activity_slots.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          : '',
      }));

      setParticipants(formattedParticipants);
    } catch (error) {
      console.error('Erreur chargement activité:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const handleViewGroup = (groupId: string, slotDate: string) => {
    router.push(`/business-group-view?id=${groupId}&name=${encodeURIComponent(`${activity?.title} - ${slotDate}`)}`);
  };

  const handleEditActivity = () => {
    router.push(`/edit-activity?id=${activity?.id}`);
  };

  const handlePauseActivity = () => {
    Alert.alert(
      'Mettre en pause',
      'Les utilisateurs ne pourront plus s\'inscrire à cette activité. Voulez-vous continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Mettre en pause', 
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('activities')
                .update({ status: 'paused' })
                .eq('id', activity?.id);
              
              setActivity(prev => prev ? { ...prev, status: 'paused' } : null);
              Alert.alert('Succès', 'Activité mise en pause');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de mettre en pause');
            }
          }
        },
      ]
    );
  };

  const handleReactivateActivity = async () => {
    try {
      await supabase
        .from('activities')
        .update({ status: 'active' })
        .eq('id', activity?.id);
      
      setActivity(prev => prev ? { ...prev, status: 'active' } : null);
      Alert.alert('Succès', 'Activité réactivée');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de réactiver');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={64} color={colors.textSecondary} />
          <Text style={styles.errorText}>Activité non trouvée</Text>
          <TouchableOpacity style={styles.backButtonAlt} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fillPercentage = (activity.totalParticipants / activity.maxParticipants) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleEditActivity}>
          <IconSymbol name="pencil" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image source={{ uri: activity.image || 'https://via.placeholder.com/400' }} style={styles.heroImage} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.heroGradient} />
          <View style={styles.heroContent}>
            <View style={styles.statusBadge}>
              <View style={[
                styles.statusDot, 
                { backgroundColor: activity.status === 'active' ? '#10b981' : activity.status === 'paused' ? '#f59e0b' : colors.textSecondary }
              ]} />
              <Text style={styles.statusText}>
                {activity.status === 'active' ? 'Active' : activity.status === 'paused' ? 'En pause' : 'Terminée'}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{activity.title}</Text>
            <Text style={styles.heroCategory}>{activity.category}</Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <IconSymbol name="person.2.fill" size={24} color={colors.primary} />
            <Text style={styles.statValue}>{activity.totalParticipants}</Text>
            <Text style={styles.statLabel}>Participants</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(fillPercentage, 100)}%` }]} />
            </View>
            <Text style={styles.statSubtext}>{activity.totalParticipants}/{activity.maxParticipants} places</Text>
          </View>

          <View style={styles.statCard}>
            <IconSymbol name="eurosign.circle.fill" size={24} color="#10b981" />
            <Text style={styles.statValue}>{activity.totalRevenue}€</Text>
            <Text style={styles.statLabel}>Revenus</Text>
          </View>

          <View style={styles.statCard}>
            <IconSymbol name="calendar" size={24} color="#f59e0b" />
            <Text style={styles.statValue}>{activity.slots.length}</Text>
            <Text style={styles.statLabel}>Créneaux</Text>
          </View>

          <View style={styles.statCard}>
            <IconSymbol name="star.fill" size={24} color="#eab308" />
            <Text style={styles.statValue}>{activity.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{activity.reviewCount} avis</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Vue d'ensemble</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'slots' && styles.tabActive]}
            onPress={() => setActiveTab('slots')}
          >
            <Text style={[styles.tabText, activeTab === 'slots' && styles.tabTextActive]}>Créneaux</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'participants' && styles.tabActive]}
            onPress={() => setActiveTab('participants')}
          >
            <Text style={[styles.tabText, activeTab === 'participants' && styles.tabTextActive]}>Participants</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <View>
              {/* Actions rapides */}
              <Text style={styles.sectionTitle}>Actions rapides</Text>
              
              <TouchableOpacity style={styles.actionCard} onPress={handleEditActivity}>
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
                  <IconSymbol name="pencil" size={20} color={colors.primary} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Modifier l'activité</Text>
                  <Text style={styles.actionSubtitle}>Éditer les informations</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={() => setShowSlotModal(true)}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#10b981' + '20' }]}>
                  <IconSymbol name="plus.circle.fill" size={20} color="#10b981" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Ajouter un créneau</Text>
                  <Text style={styles.actionSubtitle}>Nouvelle date disponible</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {activity.status === 'active' ? (
                <TouchableOpacity style={styles.actionCard} onPress={handlePauseActivity}>
                  <View style={[styles.actionIcon, { backgroundColor: '#f59e0b' + '20' }]}>
                    <IconSymbol name="pause.circle.fill" size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Mettre en pause</Text>
                    <Text style={styles.actionSubtitle}>Suspendre les inscriptions</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : activity.status === 'paused' && (
                <TouchableOpacity style={styles.actionCard} onPress={handleReactivateActivity}>
                  <View style={[styles.actionIcon, { backgroundColor: '#10b981' + '20' }]}>
                    <IconSymbol name="play.circle.fill" size={20} color="#10b981" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Réactiver</Text>
                    <Text style={styles.actionSubtitle}>Reprendre les inscriptions</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {activeTab === 'slots' && (
            <View>
              <Text style={styles.sectionTitle}>Créneaux ({activity.slots.length})</Text>
              
              {activity.slots.length === 0 ? (
                <View style={styles.emptySlots}>
                  <IconSymbol name="calendar.badge.exclamationmark" size={48} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>Aucun créneau</Text>
                  <TouchableOpacity 
                    style={styles.addSlotButton}
                    onPress={() => setShowSlotModal(true)}
                  >
                    <Text style={styles.addSlotButtonText}>Ajouter un créneau</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                activity.slots.map(slot => (
                  <View key={slot.id} style={styles.slotCard}>
                    <View style={styles.slotInfo}>
                      <Text style={styles.slotDate}>{slot.date}</Text>
                      <Text style={styles.slotTime}>{slot.timeStart} - {slot.timeEnd}</Text>
                      <View style={styles.slotParticipants}>
                        <IconSymbol name="person.2.fill" size={14} color={colors.primary} />
                        <Text style={styles.slotParticipantsText}>
                          {slot.participants}/{slot.maxParticipants}
                        </Text>
                      </View>
                    </View>
                    
                    {slot.hasGroup && slot.groupId && (
                      <TouchableOpacity 
                        style={styles.viewGroupButton}
                        onPress={() => handleViewGroup(slot.groupId!, slot.date)}
                      >
                        <IconSymbol name="eye.fill" size={16} color={colors.primary} />
                        <Text style={styles.viewGroupText}>Voir le groupe</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'participants' && (
            <View>
              <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
              
              {participants.length === 0 ? (
                <View style={styles.emptyParticipants}>
                  <IconSymbol name="person.2" size={48} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>Aucun participant</Text>
                  <Text style={styles.emptySubtext}>Les participants apparaîtront ici</Text>
                </View>
              ) : (
                participants.map(participant => (
                  <TouchableOpacity 
                    key={participant.id} 
                    style={styles.participantCard}
                    onPress={() => router.push(`/user-profile?id=${participant.id}`)}
                  >
                    <Image 
                      source={{ uri: participant.avatar || 'https://via.placeholder.com/44' }} 
                      style={styles.participantAvatar} 
                    />
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{participant.name}</Text>
                      <Text style={styles.participantMeta}>
                        Inscrit le {participant.joinedAt} • {participant.slotDate}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>


      {/* Modal Calendrier pour ajouter des créneaux */}
<Modal
  visible={showSlotModal}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setShowSlotModal(false)}
>
  <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={styles.modalSlotHeader}>
      <TouchableOpacity onPress={() => setShowSlotModal(false)}>
        <IconSymbol name="xmark" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.modalSlotTitle}>Gérer les créneaux</Text>
      <TouchableOpacity onPress={() => {
        setShowSlotModal(false);
        loadActivityData(); // Recharger les données
      }}>
        <Text style={styles.modalSlotDone}>Terminé</Text>
      </TouchableOpacity>
    </View>
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <ActivityCalendar
        activityId={activity?.id}
        mode="edit"
      />
    </ScrollView>
  </SafeAreaView>
</Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    color: colors.text,
  },
  backButtonAlt: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: colors.background,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    height: 200,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  heroCategory: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.background,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
    marginLeft: 14,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptySlots: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  addSlotButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  addSlotButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.background,
  },
  slotCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  slotInfo: {
    flex: 1,
  },
  slotDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  slotTime: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  slotParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  slotParticipantsText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  viewGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewGroupText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyParticipants: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  modalSlotHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 20,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
},
modalSlotTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: colors.text,
},
modalSlotDone: {
  fontSize: 16,
  fontWeight: '600',
  color: colors.primary,
},
  participantMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});