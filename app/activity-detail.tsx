// app/activity-detail.tsx
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import ActivityCalendar from '@/components/ActivityCalendar';

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
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [joiningInProgress, setJoiningInProgress] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{id: string; date: string; time: string} | null>(null);

  useEffect(() => {
    loadActivity();
  }, [id]);

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
          .select('id, full_name, avatar_url')
          .eq('id', activityData.host_id)
          .single();
        // Compter le nombre RÉEL de participants depuis activity_participants
        const { count: realParticipantCount } = await supabase
          .from('activity_participants')
          .select('*', { count: 'exact', head: true })
          .eq('activity_id', activityId);

        const participantCount = realParticipantCount || 0;

        // Vérifier si l'utilisateur actuel est déjà inscrit
        if (userId) {
          const { data: participation } = await supabase
            .from('activity_participants')
            .select('id')
            .eq('activity_id', activityId)
            .eq('user_id', userId)
            .single();

          setIsJoined(!!participation);
        }

        // Construire l'objet activity
        setActivity({
          id: activityData.id,
          title: activityData.nom || activityData.titre,
          description: activityData.description,
          image: activityData.image_url,
          host: {
            id: activityData.host_id,
            name: hostProfile?.full_name || 'Organisateur',
            avatar: hostProfile?.avatar_url || '',
            type: activityData.host_type || 'Particulier',
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
            : 'Horaires à confirmer',
          location: activityData.adresse,
          city: `${activityData.ville} ${activityData.code_postal || ''}`.trim(),
          capacity: activityData.max_participants,
          participants: participantCount,
          placesRestantes: activityData.max_participants - participantCount,
          category: activityData.categorie,
          price: activityData.prix > 0 ? `€${activityData.prix.toFixed(2)}` : 'Gratuit',
          includes: activityData.inclusions || [],
          rules: activityData.regles || [],
          nextDates: activityData.dates_supplementaires
            ? activityData.dates_supplementaires.split(', ')
            : [],
        });
      }
    } catch (error) {
      console.error('Erreur chargement activité:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour envoyer un message système dans le groupe
  const sendSystemMessage = async (conversationId: string, message: string) => {
    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: message,
        message_type: 'system', // Type spécial pour les messages système
      });
      console.log('✅ Message système envoyé:', message);
    } catch (error) {
      console.error('Erreur envoi message système:', error);
    }
  };

  // Fonction pour créer ou rejoindre le groupe de conversation du CRÉNEAU
  const handleSlotGroup = async (slotId: string, activityTitle: string, activityImage: string, slotDate: string, slotTime: string) => {
    if (!currentUserId) return;

    try {
      // Récupérer le nom de l'utilisateur actuel
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();
      const userName = userProfile?.full_name || 'Un utilisateur';

      // Formater la date pour le nom du groupe
      const dateObj = new Date(slotDate);
      const formattedDate = dateObj.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      });
      const formattedTime = slotTime.replace(':', 'h');
      const groupName = `${activityTitle} - ${formattedDate} ${formattedTime}`;

      // Vérifier s'il existe déjà une conversation pour CE CRÉNEAU
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('slot_id', slotId)
        .maybeSingle();

      if (existingConv) {
        // La conversation existe, vérifier si l'utilisateur y est déjà
        const { data: existingParticipant } = await supabase
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', existingConv.id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!existingParticipant) {
          // Ajouter l'utilisateur au groupe existant
          await supabase
            .from('conversation_participants')
            .insert({
              conversation_id: existingConv.id,
              user_id: currentUserId,
            });
          
          // Envoyer un message système
          await sendSystemMessage(existingConv.id, `${userName} a rejoint le groupe`);
          console.log('✅ Utilisateur ajouté au groupe du créneau');
        }
      } else {
        // Compter les participants pour ce créneau
        const { count } = await supabase
          .from('slot_participants')
          .select('*', { count: 'exact', head: true })
          .eq('slot_id', slotId);

        // Créer le groupe seulement si >= 2 participants
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

          if (convError) {
            console.error('❌ Erreur création conversation:', convError);
            throw convError;
          }

          // Récupérer tous les participants du créneau
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

            // Message système de bienvenue
            await sendSystemMessage(newConv.id, `Groupe créé pour "${groupName}"`);
            console.log('✅ Groupe créé pour le créneau:', groupName);
          }
        }
      }
    } catch (error) {
      console.error('Erreur gestion groupe créneau:', error);
    }
  };

  // Fonction pour retirer l'utilisateur du groupe du créneau
  const handleLeaveSlotGroup = async (slotId: string) => {
    if (!currentUserId) return;

    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();
      const userName = userProfile?.full_name || 'Un utilisateur';

      // Trouver la conversation du créneau
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
          await supabase
            .from('conversations')
            .delete()
            .eq('id', conv.id);
        }
      }
    } catch (error) {
      console.error('Erreur retrait du groupe créneau:', error);
    }
  };

  const handleJoinLeave = async () => {
    if (!activity || !currentUserId || joiningInProgress) return;

    // Si on rejoint, vérifier qu'un créneau est sélectionné
    if (!isJoined && !selectedSlot) {
      Alert.alert('Sélectionnez un créneau', 'Veuillez choisir une date et un horaire avant de rejoindre.');
      return;
    }

    setJoiningInProgress(true);

    try {
      if (isJoined) {
        // === SE DÉSINSCRIRE ===
        
        // Récupérer le slot_id de l'inscription actuelle
        const { data: currentParticipation } = await supabase
          .from('slot_participants')
          .select('slot_id')
          .eq('activity_id', activity.id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (currentParticipation?.slot_id) {
          // Supprimer de slot_participants
          await supabase
            .from('slot_participants')
            .delete()
            .eq('activity_id', activity.id)
            .eq('user_id', currentUserId);

          // Retirer du groupe du créneau
          await handleLeaveSlotGroup(currentParticipation.slot_id);
        }

        // Mettre à jour le compteur dans activities
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

        // Ajouter dans slot_participants (table liée au créneau)
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

        // Mettre à jour le compteur dans activities
        const newCount = activity.participants + 1;
        await supabase
          .from('activities')
          .update({ participants: newCount })
          .eq('id', activity.id);

        // Gérer le groupe de conversation du CRÉNEAU
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

  if (!activity) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={64} color={colors.textSecondary} />
          <Text style={styles.errorText}>Activité non trouvée</Text>
          <TouchableOpacity
            style={styles.backButtonError}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFull = activity.placesRestantes <= 0;
  const isHost = currentUserId === activity.host.id;

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton}>
          <IconSymbol name="square.and.arrow.up" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Image source={{ uri: activity.image }} style={styles.heroImage} />

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{activity.title}</Text>
              <Text style={styles.subtitle}>{activity.host.type}</Text>
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.hostSection}
            onPress={() => router.push(`/user-profile?id=${activity.host.id}`)}
          >
            <Image
              source={{ uri: activity.host.avatar || 'https://via.placeholder.com/48' }}
              style={styles.hostAvatar}
            />
            <View style={styles.hostInfo}>
              <Text style={styles.hostName}>{activity.host.name}</Text>
              <Text style={styles.hostLabel}>Organisateur</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{activity.date}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <IconSymbol name="clock" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Horaires</Text>
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
                <Text style={styles.detailLabel}>Participants</Text>
                <Text style={styles.detailValue}>
                  {activity.participants} / {activity.capacity} inscrits
                </Text>
              </View>
            </View>

            {/* Bouton Voir sur la carte */}
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/browse',
                  params: {
                    viewMode: 'maps',
                    selectedActivityId: activity.id,
                  },
                })
              }
            >
              <IconSymbol name="map.fill" size={18} color={colors.primary} />
              <Text style={styles.mapButtonText}>Voir sur la carte</Text>
            </TouchableOpacity>
          </View>

          {/* Calendrier des créneaux */}
          <View style={styles.section}>
            <ActivityCalendar 
              activityId={activity.id} 
              onSlotSelect={(slot) => setSelectedSlot(slot)}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <Text style={styles.description}>{activity.description}</Text>
          </View>

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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Participants ({activity.participants})
            </Text>
            {activity.participants === 0 ? (
              <View style={styles.emptyParticipants}>
                <IconSymbol name="person.2" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyParticipantsText}>
                  Soyez le premier à rejoindre !
                </Text>
              </View>
            ) : (
              <View style={styles.participantsInfo}>
                <IconSymbol name="person.2.fill" size={24} color={colors.primary} />
                <Text style={styles.participantsText}>
                  {activity.participants}{' '}
                  {activity.participants === 1 ? 'personne inscrite' : 'personnes inscrites'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Footer - Ne pas afficher si c'est l'hôte */}
      {!isHost && (
        <View style={styles.footer}>
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
                  ? 'Sélectionnez un horaire'
                  : 'Rejoindre'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  heroImage: {
    width: '100%',
    height: 300,
    backgroundColor: colors.border,
  },
  content: {
    padding: 20,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  hostSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  hostLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  detailSubvalue: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  mapButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  datesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dateChipText: {
    fontSize: 14,
    color: colors.text,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  emptyParticipants: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  emptyParticipantsText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
  },
  participantsText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 34,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerInfo: {},
  footerPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  footerLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  actionButtonLeave: {
    backgroundColor: colors.textSecondary,
  },
  actionButtonDisabled: {
    backgroundColor: colors.border,
  },
  actionButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtonTextDisabled: {
    color: colors.background + '99',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
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
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonError: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});