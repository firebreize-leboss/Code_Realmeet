// app/group-info.tsx
// Page d'informations du groupe — Design "Hero Banner"

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

interface GroupMember {
  id: string;
  name: string;
  avatar: string;
  isCurrentUser: boolean;
}

interface GroupInfo {
  id: string;
  name: string;
  image: string;
  activityId: string | null;
  slotId: string | null;
  memberCount: number;
}

export default function GroupInfoScreen() {
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadGroupInfo();
  }, [conversationId]);

  const loadGroupInfo = async () => {
    try {
      setLoading(true);

      // Récupérer l'utilisateur actuel
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      setCurrentUserId(userId || null);

      if (!conversationId) return;

      // Récupérer les infos de la conversation
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id, name, image_url, activity_id, slot_id')
        .eq('id', conversationId)
        .single();

      if (convError) throw convError;

      // Récupérer les participants avec leurs profils
      const { data: participants, error: partError } = await supabase
        .from('conversation_participants')
        .select(`
          user_id,
          profiles:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId);

      if (partError) throw partError;

      // Formater les membres
      const formattedMembers: GroupMember[] = participants?.map((p: any) => ({
        id: p.user_id,
        name: p.profiles?.full_name || 'Utilisateur',
        avatar: p.profiles?.avatar_url || '',
        isCurrentUser: p.user_id === userId,
      })) || [];

      // Trier pour mettre l'utilisateur actuel en premier
      formattedMembers.sort((a, b) => {
        if (a.isCurrentUser) return -1;
        if (b.isCurrentUser) return 1;
        return a.name.localeCompare(b.name);
      });

      setGroupInfo({
        id: convData.id,
        name: convData.name || 'Groupe',
        image: convData.image_url || '',
        activityId: convData.activity_id,
        slotId: convData.slot_id,
        memberCount: formattedMembers.length,
      });

      setMembers(formattedMembers);
    } catch (error) {
      console.error('Erreur chargement groupe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentUserId || !groupInfo) return;

    Alert.alert(
      'Quitter le groupe',
      groupInfo.activityId
        ? 'En quittant ce groupe, vous serez également désinscrit de l\'activité. Continuer ?'
        : 'Êtes-vous sûr de vouloir quitter ce groupe ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              setLeaving(true);

              // Récupérer le nom de l'utilisateur pour le message système
              const { data: userProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', currentUserId)
                .single();
              const userName = userProfile?.full_name || 'Un utilisateur';

              // Envoyer un message système avant de quitter
              await supabase.from('messages').insert({
                conversation_id: groupInfo.id,
                sender_id: currentUserId,
                content: `${userName} a quitté le groupe`,
                message_type: 'system',
              });

              // Retirer l'utilisateur du groupe de conversation
              await supabase
                .from('conversation_participants')
                .delete()
                .eq('conversation_id', groupInfo.id)
                .eq('user_id', currentUserId);

              // Supprimer l'utilisateur de slot_group_members pour éviter les fantômes
              if (groupInfo.slotId) {
                const { data: slotGroups } = await supabase
                  .from('slot_groups')
                  .select('id')
                  .eq('slot_id', groupInfo.slotId);

                if (slotGroups && slotGroups.length > 0) {
                  const groupIds = slotGroups.map(g => g.id);
                  await supabase
                    .from('slot_group_members')
                    .delete()
                    .in('group_id', groupIds)
                    .eq('user_id', currentUserId);
                }
              }

              // Si c'est un groupe d'activité, désinscrire aussi de l'activité
              if (groupInfo.activityId) {
                // Supprimer de activity_participants
                await supabase
                  .from('activity_participants')
                  .delete()
                  .eq('activity_id', groupInfo.activityId)
                  .eq('user_id', currentUserId);

                // Mettre à jour le compteur de participants
                const { data: activity } = await supabase
                  .from('activities')
                  .select('participants')
                  .eq('id', groupInfo.activityId)
                  .single();

                if (activity) {
                  await supabase
                    .from('activities')
                    .update({ participants: Math.max(0, activity.participants - 1) })
                    .eq('id', groupInfo.activityId);
                }
              }

              // Vérifier combien de participants restent
              const { count } = await supabase
                .from('conversation_participants')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', groupInfo.id);

              // Si moins de 2 participants, supprimer la conversation
              if (count !== null && count < 2) {
                await supabase
                  .from('conversations')
                  .delete()
                  .eq('id', groupInfo.id);
              }

              // Retourner à la liste des chats
              router.replace('/(tabs)/chat');
            } catch (error) {
              console.error('Erreur lors du départ:', error);
              Alert.alert('Erreur', 'Impossible de quitter le groupe.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const handleMemberPress = (member: GroupMember) => {
    if (!member.isCurrentUser) {
      router.push(`/user-profile?id=${member.id}`);
    }
  };

  const handleViewActivity = () => {
    if (groupInfo?.activityId) {
      router.push(`/activity-detail?id=${groupInfo.activityId}`);
    }
  };

  if (loading || !fontsLoaded) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!groupInfo) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Groupe non trouvé</Text>
          <TouchableOpacity style={styles.backButtonError} onPress={() => router.back()}>
            <Text style={styles.backButtonErrorText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hasImage = groupInfo.image && groupInfo.image.length > 0;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} bounces={true}>
        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          {hasImage ? (
            <Image source={{ uri: groupInfo.image }} style={styles.heroImage} />
          ) : (
            <LinearGradient
              colors={['#F2994A', '#F5C47A']}
              style={styles.heroImage}
            />
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.4, 1]}
            style={styles.heroOverlay}
          />

          {/* Bouton retour */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 10 }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Infos en bas du hero */}
          <View style={styles.heroContent}>
            <Text style={styles.heroGroupName}>{groupInfo.name}</Text>
            <View style={styles.heroMemberRow}>
              <IconSymbol name="person.2.fill" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroMemberCount}>
                {groupInfo.memberCount} {groupInfo.memberCount > 1 ? 'membres' : 'membre'}
              </Text>
            </View>
          </View>
        </View>

        {/* Contenu sous le hero */}
        <View style={styles.content}>
          {/* Card lien vers l'activité */}
          {groupInfo.activityId && (
            <TouchableOpacity
              style={styles.activityCard}
              onPress={handleViewActivity}
              activeOpacity={0.7}
            >
              <View style={styles.activityIconContainer}>
                <IconSymbol name="calendar" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.activityCardInfo}>
                <Text style={styles.activityCardTitle} numberOfLines={1}>
                  Voir l'activité
                </Text>
                <Text style={styles.activityCardSubtitle}>
                  Consulter les détails
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          {/* Section Membres */}
          <View style={styles.membersSection}>
            <Text style={styles.sectionLabel}>MEMBRES</Text>
            <View style={styles.membersList}>
              {members.map((member, index) => (
                <React.Fragment key={member.id}>
                  <TouchableOpacity
                    style={styles.memberItem}
                    onPress={() => handleMemberPress(member)}
                    disabled={member.isCurrentUser}
                    activeOpacity={0.6}
                  >
                    <Image
                      source={{ uri: member.avatar || undefined }}
                      style={styles.memberAvatar}
                    />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.name}
                        {member.isCurrentUser && (
                          <Text style={styles.memberYou}> (vous)</Text>
                        )}
                      </Text>
                    </View>
                    {!member.isCurrentUser && (
                      <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                  {index < members.length - 1 && (
                    <View style={styles.memberSeparator} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Bouton quitter le groupe */}
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveGroup}
            disabled={leaving}
            activeOpacity={0.6}
          >
            {leaving ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <IconSymbol name="arrow.right.square" size={20} color={colors.error} />
                <Text style={styles.leaveButtonText}>
                  {groupInfo.activityId ? 'Quitter le groupe et l\'activité' : 'Quitter le groupe'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
}

const HERO_HEIGHT = 220;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },

  // Hero Banner
  heroBanner: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  heroGroupName: {
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMemberCount: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: 'rgba(255,255,255,0.85)',
  },

  // Contenu principal
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Card activité
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityCardTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  activityCardSubtitle: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Section membres
  membersSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  membersList: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.borderLight,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14,
  },
  memberName: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  memberYou: {
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  memberSeparator: {
    height: 0.5,
    backgroundColor: colors.borderSubtle,
    marginLeft: 72,
  },

  // Bouton quitter
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.inputBackground,
    borderRadius: 14,
    padding: 14,
  },
  leaveButtonText: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.error,
  },

  bottomSpacer: {
    height: 40,
  },

  // États loading/erreur
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
    marginBottom: 16,
  },
  backButtonError: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonErrorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
  },
});
