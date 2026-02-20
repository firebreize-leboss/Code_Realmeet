// app/activity-detail.tsx
// Page de détail d'une activité - Design Too Good To Go
// Sections verticales pleine largeur, séparateurs fins, typographie Manrope

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
import { CheckinQRSection } from '@/components/CheckinQRSection';
import { colors, typography, spacing, borderRadius, shadows } from '@/styles/commonStyles';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

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

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

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
  const [joinedSlotId, setJoinedSlotId] = useState<string | undefined>(undefined);
  const [slotParticipantId, setSlotParticipantId] = useState<string | undefined>(undefined);
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
          setJoinedSlotId(participation?.slot_id || undefined);
          setSlotParticipantId(participation?.id || undefined);

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
            type: isHostBusiness ? 'Professionnel' : 'Particulier',
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
        // Logique de désinscription (reste inchangée)
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
        setJoinedSlotId(undefined);
        setSlotParticipantId(undefined);
        setSelectedSlot(null);
        setActivity({
          ...activity,
          participants: newCount,
          placesRestantes: activity.capacity - newCount,
        });

        setCalendarRefreshTrigger(prev => prev + 1);

        Alert.alert('Succès', 'Vous vous êtes désinscrit de cette activité.');
      } else {
        // Logique d'inscription - Redirection vers le flow de paiement
        if (!selectedSlot) return;

        // Règle J-1 : bloquer l'inscription si le créneau débute dans moins de 24h
        const timePart = selectedSlot.time ? selectedSlot.time.slice(0, 5) : '00:00';
        const slotStart = new Date(`${selectedSlot.date}T${timePart}:00`);
        const in24hMs = Date.now() + 24 * 60 * 60 * 1000;
        if (slotStart.getTime() <= in24hMs) {
          Alert.alert(
            'Inscription impossible',
            "L'activité se déroule dans moins de 24h. Vous ne pouvez plus vous inscrire."
          );
          return;
        }

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

        // Formater la date pour l'affichage
        const slotDateFormatted = new Date(selectedSlot.date).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });

        // Naviguer vers le flow de paiement avec les paramètres nécessaires
        router.push({
          pathname: '/payment/select-method',
          params: {
            activity_id: activity.id,
            slot_id: selectedSlot.id,
            activity_name: activity.title,
            slot_date: slotDateFormatted,
            slot_time: selectedSlot.time,
            price: activity.price,
            host_id: activity.host.id,
            max_participants: activity.capacity.toString(),
            current_participants: activity.participants.toString(),
          },
        });
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
          <ActivityIndicator size="large" color={colors.primary} />
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
          <IconSymbol name="exclamationmark.triangle" size={64} color={colors.primaryMuted} />
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

  const showFooter = (!isHost && !isActivityPast) || (isHost && isBusiness);
  const calculatedPaddingBottom = showFooter ? 70 + insets.bottom : 0;
  const scrollBottomPadding = showFooter ? 0 : Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 0);

  return (
    <View style={styles.container}>
      {/* Header avec image pleine largeur */}
      <View style={styles.heroContainer}>
        <Image source={{ uri: activity.image || 'https://via.placeholder.com/400' }} style={styles.heroImage} />
        {/* Overlay noir 5% */}
        <View style={styles.heroOverlay} />
        {/* Dégradé léger en haut pour lisibilité des boutons */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.15)', 'transparent']}
          style={styles.heroGradientTop}
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

        {/* Titre en bas à gauche */}
        <Text style={styles.heroTitle}>{activity.title}</Text>

        {/* Catégorie en bas à droite */}
        <View style={styles.heroCategoryBadge}>
          <Text style={styles.heroCategoryText}>{activity.category}</Text>
        </View>

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
          { flexGrow: 1, paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        {/* Badge activité terminée */}
        {isActivityPast && (
          <View style={styles.pastActivityBanner}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
            <Text style={styles.pastActivityBannerText}>Activité terminée</Text>
          </View>
        )}

        {/* SECTION: Rating */}
        {activityRating && activityRating.count > 0 && (
          <>
            <View style={styles.section}>
              <View style={styles.infoRow}>
                <IconSymbol name="star.fill" size={20} color="#F59E0B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>
                    {activityRating.average.toFixed(1)} ({activityRating.count} avis)
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.sectionDivider} />
          </>
        )}

        {/* SECTION: Organisateur */}
        <TouchableOpacity
          style={styles.section}
          onPress={handleOrganizerPress}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionLabel}>Organisateur</Text>
          <View style={styles.infoRow}>
            <Image
              source={{ uri: activity.host.avatar || 'https://via.placeholder.com/48' }}
              style={styles.hostAvatar}
            />
            <View style={styles.infoContent}>
              <View style={styles.hostNameRow}>
                <Text style={styles.infoValue}>{activity.host.name}</Text>
                {activity.host.isVerified && (
                  <IconSymbol name="checkmark.seal.fill" size={18} color={colors.primary} />
                )}
                {activity.host.accountType === 'business' && (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.hostType}>{activity.host.type}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        <View style={styles.sectionDivider} />

        {/* SECTION: Lieu */}
        {(activity.location || activity.city) && (
          <>
            <TouchableOpacity
              style={styles.section}
              onPress={() => router.push(`/(tabs)/browse?viewMode=maps&selectedActivityId=${activity.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionLabel}>Lieu</Text>
              <View style={styles.infoRow}>
                <IconSymbol name="location.fill" size={20} color={colors.textTertiary} />
                <View style={styles.infoContent}>
                  {activity.location && <Text style={styles.infoValue}>{activity.location}</Text>}
                  {activity.city && <Text style={styles.infoSubvalue}>{activity.city}</Text>}
                </View>
                <IconSymbol name="map.fill" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
            <View style={styles.sectionDivider} />
          </>
        )}

        {/* SECTION: Calendrier de sélection */}
        {!isActivityPast && (
          <>
            <View style={styles.sectionSlots}>
              <ActivityCalendar
                activityId={activity.id}
                onSlotSelect={(isBusiness || isJoined) ? undefined : (slot) => setSelectedSlot(slot)}
                externalSelectedSlot={selectedSlot}
                mode="select"
                readOnly={isBusiness || isJoined}
                userJoinedSlotId={isJoined ? joinedSlotId : undefined}
                maxParticipants={activity.capacity}
                refreshTrigger={calendarRefreshTrigger}
              />
            </View>
            <View style={styles.sectionDivider} />
          </>
        )}

        {/* SECTION: Description */}
        <View style={styles.sectionAbout}>
          <Text style={styles.sectionTitleAbout}>À propos</Text>
          <Text style={styles.description}>{activity.description}</Text>
        </View>
        <View style={styles.sectionDivider} />

        {/* SECTION: Inclus */}
        {!isActivityPast && activity.includes.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ce qui est inclus</Text>
              {activity.includes.map((item: string, index: number) => (
                <View key={index} style={styles.listItem}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                  <Text style={styles.listItemText}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.sectionDivider} />
          </>
        )}

        {/* SECTION: Règles */}
        {!isActivityPast && activity.rules.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations importantes</Text>
              {activity.rules.map((rule: string, index: number) => (
                <View key={index} style={styles.listItem}>
                  <IconSymbol name="info.circle.fill" size={20} color={colors.textTertiary} />
                  <Text style={styles.listItemText}>{rule}</Text>
                </View>
              ))}
            </View>
            <View style={styles.sectionDivider} />
          </>
        )}

        {/* SECTION: Participants */}
        {shouldShowParticipants && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Participants ({participantsList.length})
              </Text>

              {participantsList.length === 0 ? (
                <View style={styles.emptyParticipants}>
                  <IconSymbol name="person.2" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyParticipantsText}>
                    Aucun participant sur votre créneau
                  </Text>
                </View>
              ) : (
                <View style={styles.participantsList}>
                  {participantsList.map((participant, index) => (
                    <React.Fragment key={participant.id}>
                      <TouchableOpacity
                        style={styles.participantItem}
                        onPress={() => router.push(`/user-profile?id=${participant.id}`)}
                      >
                        <Image
                          source={{ uri: participant.avatar || 'https://via.placeholder.com/44' }}
                          style={styles.participantAvatar}
                        />
                        <Text style={styles.participantName}>{participant.name}</Text>
                        <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                      {index < participantsList.length - 1 && (
                        <View style={styles.participantDivider} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* SECTION: QR Check-in */}
        {isJoined && !isHost && !isBusiness && !isActivityPast && slotParticipantId && joinedSlotId && (
          <>
            <View style={styles.sectionDivider} />
            <View style={styles.section}>
              <CheckinQRSection
                slotParticipantId={slotParticipantId}
                slotId={joinedSlotId}
                activityName={activity.title}
                slotDate={selectedSlot?.date || ''}
                slotTime={selectedSlot?.time || ''}
                organizerName={activity.host?.name}
              />
            </View>
          </>
        )}

        {/* SECTION: Review */}
        {isActivityPast && !isHost && !isBusiness && (
          <View style={styles.section}>
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
                <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} />
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
                <IconSymbol name="eye.fill" size={20} color={colors.primaryMuted} />
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
                  <ActivityIndicator size="small" color={isJoined ? colors.textSecondary : '#FFFFFF'} />
                ) : (
                  <Text style={[styles.actionButtonText, isJoined && styles.actionButtonTextLeave]}>
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
              <IconSymbol name="square.and.arrow.up" size={20} color={colors.text} />
              <Text style={styles.modalOptionText}>Partager</Text>
            </TouchableOpacity>

            {!isHost && (
              <TouchableOpacity style={styles.modalOption} onPress={handleReportActivity}>
                <IconSymbol name="flag.fill" size={20} color={colors.textSecondary} />
                <Text style={[styles.modalOptionText, { color: colors.textSecondary }]}>
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

// ============================================================
// STYLES - Design Too Good To Go
// Sections verticales pleine largeur, séparateurs fins, fond blanc
// ============================================================

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
    fontSize: typography.base,
    color: colors.textTertiary,
    fontFamily: 'Manrope_500Medium',
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: typography.lg,
    color: colors.text,
    fontFamily: 'Manrope_600SemiBold',
    marginTop: 16,
  },
  backButtonError: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    marginTop: 20,
  },
  backButtonErrorText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_600SemiBold',
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
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ScrollView
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    // Pas de flexGrow: 1 - cela causait un bug de scroll infini
    // Le contenu doit s'arrêter naturellement après la dernière section
  },

  // Hero - Full width avec overlay 5%
  heroContainer: {
    position: 'relative',
    width: SCREEN_WIDTH,
  },
  heroImage: {
    width: '100%',
    height: 280,
    backgroundColor: colors.borderSubtle,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  heroGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  heroTitle: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 100,
    fontSize: typography.xxl,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroCategoryBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  heroCategoryText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  competitorBadge: {
    position: 'absolute',
    bottom: 56,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  competitorBadgeText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },

  // Past activity banner
  pastActivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: borderRadius.md,
    gap: 8,
  },
  pastActivityBannerText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },

  // Section - Pleine largeur sans card
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
  },

  // Section À propos - avec moins d'espace
  sectionAbout: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },

  // Section Créneaux - compacte
  sectionSlots: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },

  // Séparateur horizontal fin
  sectionDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginHorizontal: 20,
  },

  // Label de section (petit, gris, au-dessus du contenu)
  sectionLabel: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Titre de section principal (plus marqué)
  sectionTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: 16,
  },

  // Titre pour la section À propos - moins d'espace en dessous
  sectionTitleAbout: {
    fontSize: typography.lg,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: 8,
  },

  // Info rows sans fond
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: 14,
  },
  infoValue: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  infoSubvalue: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Host
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.borderSubtle,
  },
  hostNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostType: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Badge PRO - version neutre grise
  proBadge: {
    backgroundColor: colors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: colors.textSecondary,
  },

  // Description
  description: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 24,
  },

  // List items
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 14,
  },
  listItemText: {
    flex: 1,
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Participants
  emptyParticipants: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyParticipantsText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginTop: 12,
  },
  participantsList: {
    marginTop: 4,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  participantDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.borderSubtle,
  },
  participantName: {
    flex: 1,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },

  // Review
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: borderRadius.md,
    gap: 10,
  },
  reviewButtonText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  alreadyReviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  alreadyReviewedText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
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
    borderTopColor: '#EBEBEB',
  },
  footerInfo: {
    flex: 1,
  },
  footerPrice: {
    fontSize: typography.xl,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
  },
  footerLabel: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  // Bouton Rejoindre - CTA principal orange
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    minWidth: 160,
    alignItems: 'center',
  },
  // Bouton Se désinscrire - secondaire outline gris
  actionButtonLeave: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  actionButtonDisabled: {
    backgroundColor: colors.borderLight,
  },
  actionButtonText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  actionButtonTextLeave: {
    color: colors.textSecondary,
  },
  businessFooter: {
    flex: 1,
    alignItems: 'center',
  },
  businessFooterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  businessFooterText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primaryMuted,
  },
  businessFooterHint: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginTop: 8,
  },
  manageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
  },
  manageButtonText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  modalOptionText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  cancelOption: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: 8,
  },
  cancelText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
