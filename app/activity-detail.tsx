// app/activity-detail.tsx
// Page de détail d'une activité avec restrictions entreprise
// Design épuré fond blanc avec accents bleu-mauve

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
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import ActivityCalendar from '@/components/ActivityCalendar';
import { useBusinessRestrictions } from '@/hooks/useBusinessRestrictions';
import { LinearGradient } from 'expo-linear-gradient';
import ReportModal from '@/components/ReportModal';
import LeaveReviewModal from '@/components/LeaveReviewModal';

// Couleurs caractéristiques bleu-mauve de l'appli
const ACCENT_COLORS = {
  primary: '#818CF8', // Mauve/indigo
  secondary: '#60A5FA', // Bleu
  gradient: ['#60A5FA', '#818CF8', '#C084FC'] as const,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ActivityDetail {
  id: string;
  title: string;
  description: string;
  image: string;
  host: {
    id: string;
    name: string;
    avatar: string;
    type: string;
    accountType: 'user' | 'business';
    isVerified?: boolean;
  };
  date: string;
  time: string;
  nextDates: string[];
  location: string;
  city: string;
  capacity: number;
  participants: number;
  placesRestantes: number;
  category: string;
  price: string;
  includes: string[];
  rules: string[];
}

export default function ActivityDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, from, slotId } = useLocalSearchParams();
  const origin = typeof from === 'string' ? from : '';
  const passedSlotId = typeof slotId === 'string' ? slotId : '';
  const shouldShowParticipants = origin === 'past' && !!passedSlotId;

  const { isBusiness, showJoinRestriction } = useBusinessRestrictions();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [joiningInProgress, setJoiningInProgress] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{id: string; date: string; time: string; duration?: number; registrationClosed?: boolean} | null>(null);
  const [participantsList, setParticipantsList] = useState<Array<{
    id: string;
    name: string;
    avatar: string;
  }>>([]);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isActivityPast, setIsActivityPast] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [pastSlotInfo, setPastSlotInfo] = useState<{ date: string; time: string } | null>(null);
  const [activityRating, setActivityRating] = useState<{ average: number; count: number } | null>(null);

  useEffect(() => {
    loadActivity();
  }, [id]);

  const sendSystemMessage = async (conversationId: string, content: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userData.user.id,
        content,
        message_type: 'system',
      });
    } catch (error) {
      console.error('Erreur envoi message système:', error);
    }
  };

  const loadActivity = async () => {
    try {
      setLoading(true);
      const activityId = id as string;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      setCurrentUserId(userId || null);

      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();

      if (activityError) throw activityError;

      if (activityData) {
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, account_type, business_name, business_verified')
          .eq('id', activityData.host_id)
          .single();

        const isHostBusiness = hostProfile?.account_type === 'business';

        const { count: realParticipantCount } = await supabase
          .from('slot_participants')
          .select('*', { count: 'exact', head: true })
          .eq('activity_id', activityId);

        const participantCount = realParticipantCount || activityData.participants || 0;

        if (userId && !isBusiness) {
          const { data: participation } = await supabase
            .from('slot_participants')
            .select('id, slot_id')
            .eq('activity_id', activityId)
            .eq('user_id', userId)
            .maybeSingle();

          setIsJoined(!!participation);

          if (participation?.slot_id) {
            const { data: slotData } = await supabase
              .from('activity_slots')
              .select('id, date, time, duration')
              .eq('id', participation.slot_id)
              .single();

            if (slotData) {
              setSelectedSlot({
                id: slotData.id,
                date: slotData.date,
                time: slotData.time?.slice(0, 5) || '',
                duration: slotData.duration || 60,
              });
            }
          }
        }

        setActivity({
          id: activityData.id,
          title: activityData.nom || activityData.titre,
          description: activityData.description,
          image: activityData.image_url,
          host: {
            id: activityData.host_id,
            name: isHostBusiness
              ? hostProfile?.business_name
              : hostProfile?.full_name || 'Organisateur',
            avatar: hostProfile?.avatar_url || '',
            type: isHostBusiness ? 'Entreprise' : 'Particulier',
            accountType: hostProfile?.account_type || 'user',
            isVerified: hostProfile?.business_verified || false,
          },
          date: activityData.date
            ? new Date(activityData.date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : 'Date à confirmer',
          time: activityData.time_start
            ? `${activityData.time_start.slice(0, 5)} - ${activityData.time_end?.slice(0, 5) || ''}`
            : 'Horaire à confirmer',
          nextDates: activityData.dates_supplementaires
            ? activityData.dates_supplementaires.split(', ')
            : [],
          location: activityData.adresse || '',
          city: `${activityData.ville || ''} ${activityData.code_postal || ''}`.trim(),
          capacity: activityData.max_participants || 0,
          participants: participantCount,
          placesRestantes: (activityData.max_participants || 0) - participantCount,
          category: activityData.categorie || '',
          price: activityData.prix ? `${activityData.prix}€` : 'Gratuit',
          includes: activityData.inclusions || [],
          rules: activityData.regles || [],
        });

        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('rating')
          .eq('activity_id', activityId);

        if (reviewsData && reviewsData.length > 0) {
          const avgRating = reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length;
          setActivityRating({
            average: Math.round(avgRating * 10) / 10,
            count: reviewsData.length,
          });
        }

        let activityIsPast = false;

        if (passedSlotId) {
          const { data: slotInfo } = await supabase
            .from('activity_slots')
            .select('date, time')
            .eq('id', passedSlotId)
            .single();

          if (slotInfo) {
            const slotDateTime = new Date(`${slotInfo.date}T${slotInfo.time || '00:00'}`);
            activityIsPast = slotDateTime < new Date();

            setPastSlotInfo({
              date: new Date(slotInfo.date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
              time: slotInfo.time?.slice(0, 5) || '00:00',
            });
          }
        }

        setIsActivityPast(activityIsPast);

        if (userId && activityIsPast && !isBusiness && activityData.host_id !== userId) {
          const { data: existingReview } = await supabase
            .from('reviews')
            .select('id')
            .eq('activity_id', activityId)
            .eq('reviewer_id', userId)
            .maybeSingle();

          setHasAlreadyReviewed(!!existingReview);
          setCanReview(!existingReview && activityData.host_id !== userId);
        }

        if (shouldShowParticipants) {
          const { data: participants } = await supabase
            .from('slot_participants')
            .select(`
              user_id,
              profiles:user_id (
                id,
                full_name,
                avatar_url
              )
            `)
            .eq('slot_id', passedSlotId);

          if (participants) {
            setParticipantsList(
              participants
                .map((p: any) => ({
                  id: p.profiles?.id || p.user_id,
                  name: p.profiles?.full_name || 'Participant',
                  avatar: p.profiles?.avatar_url || '',
                }))
                .filter(p => p.id !== userId)
            );
          } else {
            setParticipantsList([]);
          }
        } else {
          setParticipantsList([]);
        }
      }
    } catch (error) {
      console.error('Erreur chargement activité:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotGroup = async (
    slotId: string,
    activityTitle: string,
    activityImage: string,
    slotDate: string,
    slotTime: string
  ) => {
    try {
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('slot_id', slotId)
        .maybeSingle();

      const groupName = `${activityTitle} - ${slotDate}`;

      if (existingConv) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        const { data: existingParticipant } = await supabase
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', existingConv.id)
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (!existingParticipant) {
          await supabase
            .from('conversation_participants')
            .insert({
              conversation_id: existingConv.id,
              user_id: userData.user.id,
            });

          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userData.user.id)
            .single();

          await sendSystemMessage(
            existingConv.id,
            `${userProfile?.full_name || 'Un utilisateur'} a rejoint le groupe`
          );
        }
      }
    } catch (error) {
      console.error('Erreur gestion groupe créneau:', error);
    }
  };

  const handleLeaveSlotGroup = async (slotId: string) => {
    if (!currentUserId) return;

    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();
      const userName = userProfile?.full_name || 'Un utilisateur';

      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('slot_id', slotId)
        .maybeSingle();

      if (conv) {
        await sendSystemMessage(conv.id, `${userName} a quitté le groupe`);

        await supabase
          .from('conversation_participants')
          .delete()
          .eq('conversation_id', conv.id)
          .eq('user_id', currentUserId);

        const { count } = await supabase
          .from('conversation_participants')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        if (count !== null && count < 2) {
          await supabase.from('conversations').delete().eq('id', conv.id);
        }
      }

      // Supprimer l'utilisateur de slot_group_members pour éviter les fantômes
      const { data: slotGroups } = await supabase
        .from('slot_groups')
        .select('id')
        .eq('slot_id', slotId);

      if (slotGroups && slotGroups.length > 0) {
        const groupIds = slotGroups.map(g => g.id);
        await supabase
          .from('slot_group_members')
          .delete()
          .in('group_id', groupIds)
          .eq('user_id', currentUserId);
      }
    } catch (error) {
      console.error('Erreur retrait du groupe créneau:', error);
    }
  };

  const handleJoinLeave = async () => {
    if (isBusiness) {
      showJoinRestriction();
      return;
    }

    if (!activity || !currentUserId || joiningInProgress) return;

    if (!isJoined && !selectedSlot) {
      Alert.alert('Sélectionnez un créneau', 'Veuillez choisir une date et un horaire avant de rejoindre.');
      return;
    }

    setJoiningInProgress(true);

    try {
      if (isJoined) {
        const { data: currentParticipation } = await supabase
          .from('slot_participants')
          .select('slot_id')
          .eq('activity_id', activity.id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (currentParticipation?.slot_id) {
          await supabase
            .from('slot_participants')
            .delete()
            .eq('activity_id', activity.id)
            .eq('user_id', currentUserId);

          await handleLeaveSlotGroup(currentParticipation.slot_id);
        }

        const newCount = Math.max(0, activity.participants - 1);
        await supabase
          .from('activities')
          .update({ participants: newCount })
          .eq('id', activity.id);

        setIsJoined(false);
        setSelectedSlot(null);
        setActivity({
          ...activity,
          participants: newCount,
          placesRestantes: activity.capacity - newCount,
        });

        // Rafraîchir le calendrier pour mettre à jour les compteurs
        setCalendarRefreshTrigger(prev => prev + 1);

        Alert.alert('Succès', 'Vous vous êtes désinscrit de cette activité.');
      } else {
        if (!selectedSlot) return;

        if (selectedSlot.registrationClosed) {
          Alert.alert(
            'Inscriptions fermées',
            'Les inscriptions pour ce créneau sont fermées. Les groupes ont été formés.'
          );
          return;
        }

        if (activity.placesRestantes <= 0) {
          Alert.alert('Complet', 'Cette activité est complète.');
          return;
        }

        const { error: insertError } = await supabase
          .from('slot_participants')
          .insert({
            slot_id: selectedSlot.id,
            activity_id: activity.id,
            user_id: currentUserId,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            Alert.alert('Info', 'Vous êtes déjà inscrit à cette activité.');
            setIsJoined(true);
            return;
          }
          throw insertError;
        }

        const newCount = activity.participants + 1;
        await supabase
          .from('activities')
          .update({ participants: newCount })
          .eq('id', activity.id);

        setIsJoined(true);
        setActivity({
          ...activity,
          participants: newCount,
          placesRestantes: activity.capacity - newCount,
        });

        // Rafraîchir le calendrier pour mettre à jour les compteurs
        setCalendarRefreshTrigger(prev => prev + 1);

        try {
          const { intelligentGroupsService } = await import('@/services/intelligent-groups.service');
          const formed = await intelligentGroupsService.checkAndFormGroupsIfNeeded(
            selectedSlot.id,
            activity.id
          );
          if (formed) {
            console.log('Groupes formés immédiatement après inscription');
          }
        } catch (err) {
          console.error('Erreur formation groupes:', err);
        }

        Alert.alert('Succès', 'Vous avez rejoint l\'activité ! Un groupe se créra 24 h avant le début de l\'activité.');
      }
    } catch (error: any) {
      console.error('Erreur inscription/désinscription:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue.');
    } finally {
      setJoiningInProgress(false);
    }
  };

  const handleOrganizerPress = () => {
    if (!activity) return;

    if (activity.host.accountType === 'business') {
      router.push(`/business-profile?id=${activity.host.id}`);
    } else {
      router.push(`/user-profile?id=${activity.host.id}`);
    }
  };

  const handleReportActivity = () => {
    setShowOptionsModal(false);
    setTimeout(() => setShowReportModal(true), 300);
  };

  // Loading
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT_COLORS.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Erreur
  if (!activity) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={64} color={ACCENT_COLORS.primary} />
          <Text style={styles.errorText}>Activité non trouvée</Text>
          <TouchableOpacity style={styles.backButtonError} onPress={() => router.back()}>
            <Text style={styles.backButtonErrorText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFull = activity.placesRestantes <= 0;
  const isHost = currentUserId === activity.host.id;
  const isCompetitorActivity = isBusiness && activity.host.id !== currentUserId;

  return (
    <View style={styles.container}>
      {/* Header avec image pleine largeur */}
      <View style={styles.heroContainer}>
        <Image source={{ uri: activity.image || 'https://via.placeholder.com/400' }} style={styles.heroImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent']}
          style={styles.heroGradient}
        />

        {/* Header buttons overlaid on image */}
        <SafeAreaView style={styles.headerOverlay} edges={['top']}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowOptionsModal(true)}>
            <IconSymbol name="ellipsis" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>

        {isCompetitorActivity && (
          <View style={styles.competitorBadge}>
            <IconSymbol name="eye.fill" size={14} color="#FFFFFF" />
            <Text style={styles.competitorBadgeText}>Veille concurrentielle</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: (!isHost || (isHost && isBusiness)) ? 100 : 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge activité terminée */}
        {isActivityPast && (
          <View style={styles.pastActivityBanner}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
            <Text style={styles.pastActivityBannerText}>Activité terminée</Text>
          </View>
        )}

        {/* Titre et catégorie */}
        <View style={styles.card}>
          <View style={styles.titleSection}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{activity.title}</Text>
              <Text style={styles.subtitle}>{activity.host.type}</Text>
              {activityRating && activityRating.count > 0 && (
                <View style={styles.activityRatingRow}>
                  <IconSymbol name="star.fill" size={16} color="#FFD700" />
                  <Text style={styles.activityRatingText}>
                    {activityRating.average.toFixed(1)}
                  </Text>
                  <Text style={styles.activityRatingCount}>
                    ({activityRating.count} avis)
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>
          </View>

          {/* Prix */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Prix</Text>
            <Text style={styles.priceValue}>{activity.price}</Text>
          </View>
        </View>

        {/* Organisateur */}
        <TouchableOpacity style={styles.card} onPress={handleOrganizerPress} activeOpacity={0.7}>
          <View style={styles.hostSection}>
            <Image
              source={{ uri: activity.host.avatar || 'https://via.placeholder.com/48' }}
              style={styles.hostAvatar}
            />
            <View style={styles.hostInfo}>
              <View style={styles.hostNameRow}>
                <Text style={styles.hostName}>{activity.host.name}</Text>
                {activity.host.isVerified && (
                  <IconSymbol name="checkmark.seal.fill" size={18} color={ACCENT_COLORS.primary} />
                )}
              </View>
              <Text style={styles.hostLabel}>Organisateur</Text>
            </View>
            {activity.host.accountType === 'business' && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
            <IconSymbol name="chevron.right" size={20} color="#999" />
          </View>
        </TouchableOpacity>

        {/* Lieu */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/(tabs)/browse?viewMode=maps&selectedActivityId=${activity.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.detailRow}>
            <IconSymbol name="location.fill" size={20} color={ACCENT_COLORS.primary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Lieu</Text>
              <Text style={styles.detailValue}>{activity.location}</Text>
              <Text style={styles.detailSubvalue}>{activity.city}</Text>
            </View>
            <IconSymbol name="map.fill" size={20} color="#999" />
          </View>
        </TouchableOpacity>

        {/* Calendrier de sélection */}
        {!isActivityPast && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Choisir un créneau</Text>
            <ActivityCalendar
              activityId={activity.id}
              onSlotSelect={(isBusiness || isJoined) ? undefined : (slot) => setSelectedSlot(slot)}
              externalSelectedSlot={selectedSlot}
              mode="select"
              readOnly={isBusiness || isJoined}
              userJoinedSlotId={isJoined ? selectedSlot?.id : undefined}
              maxParticipants={activity.capacity}
              refreshTrigger={calendarRefreshTrigger}
            />
          </View>
        )}

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <Text style={styles.description}>{activity.description}</Text>
        </View>

        {/* Inclus */}
        {!isActivityPast && activity.includes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ce qui est inclus</Text>
            {activity.includes.map((item: string, index: number) => (
              <View key={index} style={styles.listItem}>
                <IconSymbol name="checkmark.circle.fill" size={20} color="#10b981" />
                <Text style={styles.listItemText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Règles */}
        {!isActivityPast && activity.rules.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Informations importantes</Text>
            {activity.rules.map((rule: string, index: number) => (
              <View key={index} style={styles.listItem}>
                <IconSymbol name="info.circle.fill" size={20} color={ACCENT_COLORS.primary} />
                <Text style={styles.listItemText}>{rule}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Participants */}
        {shouldShowParticipants && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Participants ({participantsList.length})
            </Text>

            {participantsList.length === 0 ? (
              <View style={styles.emptyParticipants}>
                <IconSymbol name="person.2" size={48} color="#CCC" />
                <Text style={styles.emptyParticipantsText}>
                  Aucun participant sur votre créneau
                </Text>
              </View>
            ) : (
              <View style={styles.participantsList}>
                {participantsList.map((participant) => (
                  <TouchableOpacity
                    key={participant.id}
                    style={styles.participantItem}
                    onPress={() => router.push(`/user-profile?id=${participant.id}`)}
                  >
                    <Image
                      source={{ uri: participant.avatar || 'https://via.placeholder.com/44' }}
                      style={styles.participantAvatar}
                    />
                    <Text style={styles.participantName}>{participant.name}</Text>
                    <IconSymbol name="chevron.right" size={16} color="#999" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Section Review */}
        {isActivityPast && !isHost && !isBusiness && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Votre avis</Text>

            {canReview ? (
              <TouchableOpacity
                style={styles.reviewButton}
                onPress={() => setShowReviewModal(true)}
              >
                <IconSymbol name="star.fill" size={20} color="#FFFFFF" />
                <Text style={styles.reviewButtonText}>Noter cette activité</Text>
              </TouchableOpacity>
            ) : hasAlreadyReviewed ? (
              <View style={styles.alreadyReviewedBadge}>
                <IconSymbol name="checkmark.circle.fill" size={16} color={ACCENT_COLORS.primary} />
                <Text style={styles.alreadyReviewedText}>Vous avez déjà noté cette activité</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {!isHost && !isActivityPast && (
        <SafeAreaView style={styles.footer} edges={['bottom']}>
          {isBusiness ? (
            <View style={styles.businessFooter}>
              <View style={styles.businessFooterInfo}>
                <IconSymbol name="eye.fill" size={20} color={ACCENT_COLORS.primary} />
                <Text style={styles.businessFooterText}>Mode observation</Text>
              </View>
              <Text style={styles.businessFooterHint}>
                Les entreprises ne peuvent pas participer aux activités
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.footerInfo}>
                <Text style={styles.footerPrice}>{activity.price}</Text>
                <Text style={styles.footerLabel}>par personne</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isJoined && styles.actionButtonLeave,
                  !isJoined && !selectedSlot && styles.actionButtonDisabled,
                  isFull && !isJoined && styles.actionButtonDisabled,
                ]}
                onPress={handleJoinLeave}
                disabled={(!isJoined && !selectedSlot) || (isFull && !isJoined) || joiningInProgress}
              >
                {joiningInProgress ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {isFull && !isJoined
                      ? 'Complet'
                      : isJoined
                      ? 'Se désinscrire'
                      : !selectedSlot
                      ? 'Choisir un créneau'
                      : 'Rejoindre'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </SafeAreaView>
      )}

      {/* Footer hôte entreprise */}
      {isHost && isBusiness && (
        <SafeAreaView style={styles.footer} edges={['bottom']}>
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => router.push(`/manage-activity?id=${activity.id}`)}
          >
            <IconSymbol name="chart.bar.fill" size={20} color="#FFFFFF" />
            <Text style={styles.manageButtonText}>Gérer cette activité</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Modal Review */}
      <LeaveReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        activityId={activity?.id || ''}
        activityTitle={activity?.title || ''}
        onReviewSubmitted={() => {
          setHasAlreadyReviewed(true);
          setCanReview(false);
        }}
      />

      {/* Modal Options */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Options</Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowOptionsModal(false);
              }}
            >
              <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
              <Text style={styles.modalOptionText}>Partager</Text>
            </TouchableOpacity>

            {!isHost && (
              <TouchableOpacity style={styles.modalOption} onPress={handleReportActivity}>
                <IconSymbol name="flag.fill" size={20} color="#FF6B6B" />
                <Text style={[styles.modalOptionText, { color: '#FF6B6B' }]}>
                  Signaler cette activité
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalOption, styles.cancelOption]}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Signalement */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="activity"
        targetId={activity?.id || ''}
        targetName={activity?.title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    marginTop: 16,
  },
  backButtonError: {
    backgroundColor: ACCENT_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 20,
  },
  backButtonErrorText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Header overlay on hero image
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 20,
    gap: 16,
  },

  // Hero - Full width
  heroContainer: {
    position: 'relative',
    width: SCREEN_WIDTH,
  },
  heroImage: {
    width: '100%',
    height: 280,
    backgroundColor: '#F0F0F0',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  competitorBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  competitorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Past activity banner
  pastActivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 16,
    gap: 8,
  },
  pastActivityBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Card (replaces glassCard)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Title section
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  activityRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  activityRatingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  activityRatingCount: {
    fontSize: 13,
    color: '#666',
  },
  categoryBadge: {
    backgroundColor: ACCENT_COLORS.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT_COLORS.primary,
  },

  // Price
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ACCENT_COLORS.primary,
  },

  // Host section
  hostSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  hostInfo: {
    flex: 1,
    marginLeft: 12,
  },
  hostNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  hostLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  proBadge: {
    backgroundColor: ACCENT_COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Detail row
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailContent: {
    flex: 1,
    marginLeft: 14,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  detailSubvalue: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  // Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },

  // Participants
  emptyParticipants: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyParticipantsText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  participantsList: {
    gap: 8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  participantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },

  // Review
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 10,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alreadyReviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  alreadyReviewedText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  footerInfo: {
    flex: 1,
  },
  footerPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  footerLabel: {
    fontSize: 13,
    color: '#666',
  },
  actionButton: {
    backgroundColor: ACCENT_COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    minWidth: 160,
    alignItems: 'center',
  },
  actionButtonLeave: {
    backgroundColor: '#EF4444',
  },
  actionButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  businessFooter: {
    flex: 1,
    alignItems: 'center',
  },
  businessFooterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ACCENT_COLORS.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  businessFooterText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT_COLORS.primary,
  },
  businessFooterHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  manageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#F8F8F8',
    marginBottom: 10,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  cancelOption: {
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
});
