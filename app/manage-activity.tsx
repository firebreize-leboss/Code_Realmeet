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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import ActivityCalendar from '@/components/ActivityCalendar';
import SlotGroupsDisplay from '@/components/SlotGroupsDisplay';

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
  status: 'active' | 'paused' | 'ended' | 'draft';
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
  hasSlotGroups?: boolean;
}

interface Participant {
  id: string;
  userId: string; // Ajout de l'userId pour pouvoir naviguer vers le profil
  name: string;
  avatar: string;
  joinedAt: string;
  slotDate: string;
  slotId?: string;
}

export default function ManageActivityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'slots'>('overview');
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [selectedSlotForGroups, setSelectedSlotForGroups] = useState<SlotStats | null>(null);

  useEffect(() => {
    loadActivityData();
  }, [id]);

  const loadActivityData = async () => {
    try {
      const activityId = id as string;

      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();

      if (activityError) throw activityError;

      const { data: slotsData } = await supabase
        .from('activity_slots')
        .select('*')
        .eq('activity_id', activityId)
        .order('date', { ascending: true });

      const slotIds = slotsData?.map(s => s.id) || [];

      const { data: participantsData, error: participantsError } = await supabase
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
        .in('slot_id', slotIds.length > 0 ? slotIds : ['00000000-0000-0000-0000-000000000000']);

      console.log('Participants chargés:', participantsData?.length, participantsError);
      
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, slot_id')
        .in('slot_id', slotIds.length > 0 ? slotIds : ['00000000-0000-0000-0000-000000000000']);

      const convMap = new Map(conversations?.map(c => [c.slot_id, c.id]) || []);

      const { data: slotGroupsData } = await supabase
        .from('slot_groups')
        .select('slot_id')
        .in('slot_id', slotIds.length > 0 ? slotIds : ['00000000-0000-0000-0000-000000000000']);
      
      const slotsWithGroups = new Set(slotGroupsData?.map(sg => sg.slot_id) || []);

      const slots: SlotStats[] = (slotsData || []).map(slot => {
        const slotParticipants = participantsData?.filter(p => p.slot_id === slot.id) || [];
        return {
          id: slot.id,
          date: new Date(slot.date).toLocaleDateString('fr-FR', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
          }),
          timeStart: slot.time_start?.slice(0, 5) || slot.time?.slice(0, 5) || '',
          timeEnd: slot.time_end?.slice(0, 5) || '',
          participants: slotParticipants.length,
          maxParticipants: slot.max_participants || activityData.max_participants,
          hasGroup: convMap.has(slot.id),
          groupId: convMap.get(slot.id),
          hasSlotGroups: slotsWithGroups.has(slot.id),
        };
      });

      const totalParticipants = participantsData?.length || 0;
      const totalRevenue = totalParticipants * (activityData.prix || 0);

      setActivity({
        id: activityData.id,
        title: activityData.nom || activityData.titre,
        image: activityData.image_url || '',
        category: activityData.categorie || '',
        totalParticipants,
        maxParticipants: activityData.max_participants,
        totalRevenue,
        averageRating: 0,
        reviewCount: 0,
        status: activityData.status || 'active',
        createdAt: activityData.created_at,
        slots,
      });

      const formattedParticipants: Participant[] = (participantsData || []).map((p: any) => ({
        id: p.id, // Utiliser l'ID de l'inscription, pas l'user_id, pour permettre plusieurs entrées du même utilisateur
        userId: p.user_id, // Garder l'userId pour naviguer vers le profil
        name: p.profiles?.full_name || 'Participant',
        avatar: p.profiles?.avatar_url || '',
        joinedAt: new Date(p.created_at).toLocaleDateString('fr-FR'),
        slotDate: p.activity_slots?.date
          ? new Date(p.activity_slots.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          : '',
        slotId: p.slot_id,
      }));

      console.log('Participants formatés:', formattedParticipants.length, formattedParticipants);
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

  const handleManageGroups = (slot: SlotStats) => {
    setSelectedSlotForGroups(slot);
    setShowGroupsModal(true);
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
              console.log('Tentative de pause pour activité:', activity?.id);
              
              const { data, error } = await supabase
                .from('activities')
                .update({ status: 'paused' })
                .eq('id', activity?.id)
                .select()
                .single();
              
              console.log('Résultat:', { data, error });
              
              if (error) {
                console.error('Erreur Supabase:', error);
                throw error;
              }
              
              setActivity(prev => prev ? { ...prev, status: 'paused' } : null);
              Alert.alert('Succès', 'Activité mise en pause');
            } catch (error: any) {
              console.error('Erreur complète:', error);
              Alert.alert('Erreur', error.message || 'Impossible de mettre en pause');
            }
          }
        },
      ]
    );
  };

  const handleReactivateActivity = async () => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({ status: 'active' })
        .eq('id', activity?.id);
      
      if (error) throw error;
      
      setActivity(prev => prev ? { ...prev, status: 'active' } : null);
      Alert.alert('Succès', 'Activité réactivée');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de réactiver');
    }
  };

  const handlePublishActivity = async () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const { count } = await supabase
      .from('activity_slots')
      .select('*', { count: 'exact', head: true })
      .eq('activity_id', activity?.id)
      .gte('date', todayStr);
    
    if (!count || count === 0) {
      Alert.alert(
        'Impossible de publier',
        'Vous devez ajouter au moins un créneau horaire postérieur à maintenant pour publier cette activité.'
      );
      return;
    }
    
    try {
      const { error } = await supabase
        .from('activities')
        .update({ status: 'active' })
        .eq('id', activity?.id);
      
      if (error) throw error;
      
      setActivity(prev => prev ? { ...prev, status: 'active' } : null);
      Alert.alert('Succès', 'Votre activité est maintenant publiée !');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de publier l\'activité');
    }
  };

  const handleViewParticipant = (participantId: string) => {
    router.push(`/user-profile?id=${participantId}`);
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
        <View style={styles.heroSection}>
          <Image source={{ uri: activity.image || 'https://via.placeholder.com/400' }} style={styles.heroImage} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.heroGradient} />
          <View style={styles.heroContent}>
            <View style={styles.statusBadge}>
              <View style={[
                styles.statusDot, 
                { backgroundColor: activity.status === 'active' ? '#10b981' : activity.status === 'paused' ? '#f59e0b' : activity.status === 'draft' ? '#6b7280' : colors.textSecondary }
              ]} />
              <Text style={styles.statusText}>
                {activity.status === 'active' ? 'Active' : activity.status === 'paused' ? 'En pause' : activity.status === 'draft' ? 'Brouillon' : 'Terminée'}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{activity.title}</Text>
            <Text style={styles.heroCategory}>{activity.category}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <IconSymbol name="person.2.fill" size={24} color={colors.primary} />
            <Text style={styles.statValue}>{activity.totalParticipants}</Text>
            <Text style={styles.statLabel}>Participants</Text>
            <Text style={styles.statSubtext}>inscrits au total</Text>
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
            <IconSymbol name="star.fill" size={24} color="#8b5cf6" />
            <Text style={styles.statValue}>{activity.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{activity.reviewCount} avis</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          {(['overview', 'participants', 'slots'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'overview' ? 'Aperçu' : tab === 'participants' ? 'Participants' : 'Créneaux'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <View>
              <Text style={styles.sectionTitle}>Actions rapides</Text>
              
              {/* Bouton Publier si brouillon */}
              {activity.status === 'draft' && (
                <TouchableOpacity style={styles.actionCard} onPress={handlePublishActivity}>
                  <View style={[styles.actionIcon, { backgroundColor: '#10b981' + '20' }]}>
                    <IconSymbol name="paperplane.fill" size={20} color="#10b981" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Publier</Text>
                    <Text style={styles.actionSubtitle}>Rendre visible aux utilisateurs</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}

              {/* Bouton Pause si active */}
              {activity.status === 'active' && (
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
              )}

              {/* Bouton Réactiver si en pause */}
              {activity.status === 'paused' && (
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
              <Text style={styles.sectionTitle}>Gérer les créneaux</Text>
              <Text style={styles.slotsHelper}>
                Appuyez sur une date pour ajouter un créneau, ou maintenez appuyé sur un créneau pour le supprimer.
              </Text>
              
              <ActivityCalendar
                activityId={activity.id}
                mode="edit"
              />

              {/* Liste des créneaux avec infos participants */}
              {activity.slots.length > 0 && (
                <View style={styles.slotsListSection}>
                  <Text style={styles.slotsListTitle}>Détails des créneaux ({activity.slots.length})</Text>
                  {activity.slots.map(slot => (
                    <View key={slot.id} style={styles.slotCard}>
                      <View style={styles.slotInfo}>
                        <Text style={styles.slotDate}>{slot.date}</Text>
                        <Text style={styles.slotTime}>
                          {slot.timeStart}{slot.timeEnd ? ` - ${slot.timeEnd}` : ''}
                        </Text>
                        <View style={styles.slotParticipants}>
                          <IconSymbol name="person.2.fill" size={14} color={colors.primary} />
                          <Text style={styles.slotParticipantsText}>
                            {slot.participants}/{slot.maxParticipants}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.slotActions}>
                        {slot.participants >= 2 && (
                          <TouchableOpacity 
                            style={[
                              styles.composeGroupButton,
                              slot.hasSlotGroups && styles.composeGroupButtonActive
                            ]}
                            onPress={() => handleManageGroups(slot)}
                          >
                            <IconSymbol 
                              name="person.3.fill" 
                              size={16} 
                              color={slot.hasSlotGroups ? colors.background : colors.primary} 
                            />
                            <Text style={[
                              styles.composeGroupText,
                              slot.hasSlotGroups && styles.composeGroupTextActive
                            ]}>
                              {slot.hasSlotGroups ? 'Groupes' : 'Composer'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        
                        {slot.hasGroup && slot.groupId && (
                          <TouchableOpacity 
                            style={styles.viewGroupButton}
                            onPress={() => handleViewGroup(slot.groupId!, slot.date)}
                          >
                            <IconSymbol name="bubble.left.and.bubble.right.fill" size={16} color={colors.primary} />
                            <Text style={styles.viewGroupText}>Chat</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'participants' && (
            <View>
              <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
              
              {participants.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="person.2" size={48} color={colors.textSecondary} />
                  <Text style={styles.emptyStateText}>Aucun participant pour le moment</Text>
                </View>
              ) : (
                participants.map((participant) => (
                  <TouchableOpacity
                    key={participant.id}
                    style={styles.participantItem}
                    onPress={() => handleViewParticipant(participant.userId)}
                  >
                    <Image
                      source={{ uri: participant.avatar || 'https://via.placeholder.com/50' }}
                      style={styles.participantAvatar}
                    />
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{participant.name}</Text>
                      <Text style={styles.participantMeta}>
                        Inscrit le {participant.joinedAt} • {participant.slotDate}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      

      {/* Modal pour gérer les groupes */}
      <Modal
        visible={showGroupsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGroupsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowGroupsModal(false)}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Composition des groupes</Text>
            <View style={{ width: 24 }} />
          </View>
          {selectedSlotForGroups && activity && (
            <SlotGroupsDisplay
              slotId={selectedSlotForGroups.id}
              activityId={activity.id}
              isHost={true}
            />
          )}
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  backButtonAlt: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
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
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  heroCategory: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
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
    fontSize: 28,
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
    marginTop: 4,
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
  tabBar: {
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
    paddingBottom: 40,
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
    color: colors.primary,
    fontWeight: '500',
  },
  slotActions: {
    flexDirection: 'row',
    gap: 8,
  },
  composeGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  composeGroupButtonActive: {
    backgroundColor: colors.primary,
  },
  composeGroupText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  composeGroupTextActive: {
    color: colors.background,
  },
  viewGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewGroupText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  participantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  participantMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  slotsHelper: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  slotsListSection: {
    marginTop: 24,
  },
  slotsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
});