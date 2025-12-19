// app/activity-detail.tsx
// Page de détail d'une activité avec restrictions entreprise

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
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import ActivityCalendar from '@/components/ActivityCalendar';
import { useBusinessRestrictions } from '@/hooks/useBusinessRestrictions';
import { LinearGradient } from 'expo-linear-gradient';

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
  const { id } = useLocalSearchParams();
  
  // Hook de restrictions entreprise
  const { isBusiness, showJoinRestriction } = useBusinessRestrictions();
  
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [joiningInProgress, setJoiningInProgress] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{id: string; date: string; time: string} | null>(null);
  const [participantsList, setParticipantsList] = useState<Array<{
  id: string;
  name: string;
  avatar: string;
  }>>([]);
  const [isActivityPast, setIsActivityPast] = useState(false);

  useEffect(() => {
    loadActivity();
  }, [id]);

  // Fonction pour envoyer un message système
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

      // Récupérer l'utilisateur actuel
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      setCurrentUserId(userId || null);

      // Récupérer les détails de l'activité
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();

      if (activityError) throw activityError;

      if (activityData) {
        // Récupérer le profil de l'hôte séparément
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, account_type, business_name, business_verified')
          .eq('id', activityData.host_id)
          .single();

        const isHostBusiness = hostProfile?.account_type === 'business';
        
        // Compter le nombre RÉEL de participants
        const { count: realParticipantCount } = await supabase
          .from('slot_participants')
          .select('*', { count: 'exact', head: true })
          .eq('activity_id', activityId);

        const participantCount = realParticipantCount || activityData.participants || 0;

        // Vérifier si l'utilisateur actuel est déjà inscrit (seulement si pas entreprise)
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

        // Construire l'objet activity
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
        // Vérifier si l'activité est passée
const checkIfPast = () => {
  if (selectedSlot) {
    const slotDateTime = new Date(`${selectedSlot.date}T${selectedSlot.time}`);
    return slotDateTime < new Date();
  }
  return false;
};
setIsActivityPast(checkIfPast());

// Si l'activité est passée ou si on veut afficher les participants
if (participantCount > 0) {
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
    .eq('activity_id', activityId);

  if (participants) {
    setParticipantsList(participants.map((p: any) => ({
      id: p.profiles?.id || p.user_id,
      name: p.profiles?.full_name || 'Participant',
      avatar: p.profiles?.avatar_url || '',
    })));
  }
}
      }
    } catch (error) {
      console.error('Erreur chargement activité:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gérer le groupe de conversation du créneau
  const handleSlotGroup = async (
    slotId: string,
    activityTitle: string,
    activityImage: string,
    slotDate: string,
    slotTime: string
  ) => {
    try {
      // Vérifier si une conversation existe déjà pour ce créneau
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('slot_id', slotId)
        .maybeSingle();

      const groupName = `${activityTitle} - ${slotDate}`;

      if (existingConv) {
        // Ajouter l'utilisateur au groupe existant
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
      } else {
        // Créer une nouvelle conversation si >= 2 participants
        const { count } = await supabase
          .from('slot_participants')
          .select('*', { count: 'exact', head: true })
          .eq('slot_id', slotId);

        if (count && count >= 2) {
          const { data: newConv, error: convError } = await supabase
            .from('conversations')
            .insert({
              slot_id: slotId,
              name: groupName,
              image_url: activityImage,
              is_group: true,
            })
            .select()
            .single();

          if (convError) throw convError;

          const { data: allParticipants } = await supabase
            .from('slot_participants')
            .select('user_id')
            .eq('slot_id', slotId);

          if (allParticipants && newConv) {
            const participantsToInsert = allParticipants.map(p => ({
              conversation_id: newConv.id,
              user_id: p.user_id,
            }));

            await supabase
              .from('conversation_participants')
              .insert(participantsToInsert);

            await sendSystemMessage(newConv.id, `Groupe créé pour "${groupName}"`);
          }
        }
      }
    } catch (error) {
      console.error('Erreur gestion groupe créneau:', error);
    }
  };

  // Retirer l'utilisateur du groupe du créneau
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
    } catch (error) {
      console.error('Erreur retrait du groupe créneau:', error);
    }
  };

  // Gérer l'inscription/désinscription
  const handleJoinLeave = async () => {
    // Bloquer si compte entreprise
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
        // === SE DÉSINSCRIRE ===
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

        Alert.alert('Succès', 'Vous vous êtes désinscrit de cette activité.');
      } else {
        // === REJOINDRE ===
        if (!selectedSlot) return;

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

        await handleSlotGroup(
          selectedSlot.id,
          activity.title,
          activity.image,
          selectedSlot.date,
          selectedSlot.time
        );

        setIsJoined(true);
        setActivity({
          ...activity,
          participants: newCount,
          placesRestantes: activity.capacity - newCount,
        });

        Alert.alert('Succès', 'Vous avez rejoint cette activité ! 🎉');
      }
    } catch (error: any) {
      console.error('Erreur inscription/désinscription:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue.');
    } finally {
      setJoiningInProgress(false);
    }
  };

  // Navigation vers le profil de l'organisateur
  const handleOrganizerPress = () => {
    if (!activity) return;
    
    if (activity.host.accountType === 'business') {
      router.push(`/business-profile?id=${activity.host.id}`);
    } else {
      router.push(`/user-profile?id=${activity.host.id}`);
    }
  };

  // Loading
  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container}>
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
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={64} color={colors.textSecondary} />
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
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton}>
          <IconSymbol name="square.and.arrow.up" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
  style={styles.scrollView}
  contentContainerStyle={[
    styles.contentContainer,
    { paddingBottom: (!isHost || (isHost && isBusiness)) ? 140 : 20 },
  ]}
>



        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: activity.image || 'https://via.placeholder.com/400' }} style={styles.heroImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.heroGradient}
          />
          
          {/* Badge concurrent pour les entreprises */}
          {isCompetitorActivity && (
            <View style={styles.competitorBadge}>
              <IconSymbol name="eye.fill" size={14} color={colors.background} />
              <Text style={styles.competitorBadgeText}>Veille concurrentielle</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Titre et catégorie */}
          <View style={styles.titleSection}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{activity.title}</Text>
              <Text style={styles.subtitle}>{activity.host.type}</Text>
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>
          </View>

          {/* Organisateur */}
          <TouchableOpacity style={styles.hostSection} onPress={handleOrganizerPress}>
            <Image
              source={{ uri: activity.host.avatar || 'https://via.placeholder.com/48' }}
              style={styles.hostAvatar}
            />
            <View style={styles.hostInfo}>
              <View style={styles.hostNameRow}>
                <Text style={styles.hostName}>{activity.host.name}</Text>
                {activity.host.isVerified && (
                  <IconSymbol name="checkmark.seal.fill" size={18} color={colors.primary} />
                )}
              </View>
              <Text style={styles.hostLabel}>Organisateur</Text>
            </View>
            {activity.host.accountType === 'business' && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
            <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

            <View style={styles.detailRow}>
              <IconSymbol name="clock" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Horaire</Text>
                <Text style={styles.detailValue}>{activity.time}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <IconSymbol name="location.fill" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Lieu</Text>
                <Text style={styles.detailValue}>{activity.location}</Text>
                <Text style={styles.detailSubvalue}>{activity.city}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <IconSymbol name="person.2.fill" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Places</Text>
                <Text style={[styles.detailValue, isFull && styles.fullText]}>
                  {activity.participants}/{activity.capacity} 
                  {isFull ? ' (Complet)' : ` (${activity.placesRestantes} restantes)`}
                </Text>
              </View>
            </View>
          </View>

          {/* Calendrier de sélection */}
          <View style={styles.section}>
            <ActivityCalendar 
              activityId={activity.id} 
              onSlotSelect={(isBusiness || isJoined) ? undefined : (slot) => setSelectedSlot(slot)}
              externalSelectedSlot={selectedSlot}
              mode="select"
              readOnly={isBusiness || isJoined}
              userJoinedSlotId={isJoined ? selectedSlot?.id : undefined}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <Text style={styles.description}>{activity.description}</Text>
          </View>

          {/* Inclus */}
          {activity.includes.length > 0 && (
            <View style={styles.section}>
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
          {activity.rules.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations importantes</Text>
              {activity.rules.map((rule: string, index: number) => (
                <View key={index} style={styles.listItem}>
                  <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
                  <Text style={styles.listItemText}>{rule}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Participants */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Participants ({activity.participants})</Text>
  {activity.participants === 0 ? (
    <View style={styles.emptyParticipants}>
      <IconSymbol name="person.2" size={48} color={colors.textSecondary} />
      <Text style={styles.emptyParticipantsText}>
        {isBusiness ? 'Aucun participant inscrit' : 'Soyez le premier à rejoindre !'}
      </Text>
    </View>
  ) : participantsList.length > 0 ? (
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
          <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  ) : (
    <View style={styles.participantsInfo}>
      <IconSymbol name="person.2.fill" size={24} color={colors.primary} />
      <Text style={styles.participantsText}>
        {activity.participants} {activity.participants === 1 ? 'personne inscrite' : 'personnes inscrites'}
      </Text>
    </View>
  )}
</View>
      </ScrollView>

      {/* Footer - Différent selon le type de compte */}
      {!isHost && (
        <View style={styles.footer}>
          {isBusiness ? (
            // Footer pour les entreprises - Mode observation
            <View style={styles.businessFooter}>
              <View style={styles.businessFooterInfo}>
                <IconSymbol name="eye.fill" size={20} color={colors.primary} />
                <Text style={styles.businessFooterText}>Mode observation</Text>
              </View>
              <Text style={styles.businessFooterHint}>
                Les entreprises ne peuvent pas participer aux activités
              </Text>
            </View>
          ) : (
            // Footer normal pour les utilisateurs
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
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={[
                    styles.actionButtonText,
                    !isJoined && !selectedSlot && styles.actionButtonTextDisabled,
                  ]}>
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
        </View>
      )}

      {/* Footer pour l'hôte entreprise - Gérer l'activité */}
      {isHost && isBusiness && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => router.push(`/manage-activity?id=${activity.id}`)}
          >
            <IconSymbol name="chart.bar.fill" size={20} color={colors.background} />
            <Text style={styles.manageButtonText}>Gérer cette activité</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  backButtonError: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonErrorText: {
    color: colors.background,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 0,
  },
  heroContainer: {
    position: 'relative',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: 280,
    backgroundColor: colors.border,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  competitorBadge: {
    position: 'absolute',
    top: 16,
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
    color: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  hostSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
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
    color: colors.text,
  },
  hostLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  proBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.background,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailContent: {
    flex: 1,
    marginLeft: 14,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  detailSubvalue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fullText: {
    color: colors.error,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: colors.text,
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
    color: colors.text,
  },
  emptyParticipants: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.card,
    borderRadius: 16,
  },
  emptyParticipantsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  participantsText: {
    fontSize: 15,
    color: colors.text,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerInfo: {
    flex: 1,
  },
  footerPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  footerLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  actionButtonLeave: {
    backgroundColor: colors.error,
  },
  actionButtonDisabled: {
    backgroundColor: colors.border,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  actionButtonTextDisabled: {
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
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  participantsList: {
  gap: 8,
},
participantItem: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.card,
  padding: 12,
  borderRadius: 12,
  gap: 12,
},
participantAvatar: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: colors.border,
},
participantName: {
  flex: 1,
  fontSize: 16,
  fontWeight: '500',
  color: colors.text,
},
  businessFooterText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  businessFooterHint: {
    fontSize: 12,
    color: colors.textSecondary,
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
    borderRadius: 14,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});