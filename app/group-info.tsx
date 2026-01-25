// app/group-info.tsx
// Page d'informations du groupe (style Instagram)

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

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
  memberCount: number;
}

export default function GroupInfoScreen() {
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();

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
        .select('id, name, image_url, activity_id')
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

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!groupInfo) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Groupe non trouvé</Text>
          <TouchableOpacity style={styles.backButtonError} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Section profil du groupe */}
        <View style={styles.profileSection}>
          <Image source={{ uri: groupInfo.image }} style={styles.groupImage} />
          <Text style={styles.groupName}>{groupInfo.name}</Text>
          <Text style={styles.memberCount}>
            {groupInfo.memberCount} {groupInfo.memberCount > 1 ? 'membres' : 'membre'}
          </Text>
        </View>

        {/* Bouton voir l'activité */}
        {groupInfo.activityId && (
          <TouchableOpacity
            style={styles.viewActivityButton}
            onPress={handleViewActivity}
          >
            <IconSymbol name="calendar" size={20} color={colors.background} />
            <Text style={styles.viewActivityButtonText}>Voir les détails de l'activité</Text>
          </TouchableOpacity>
        )}

        {/* Bouton voir l'activité (si groupe d'activité) */}
        {groupInfo.activityId && (
          <TouchableOpacity style={styles.activityButton} onPress={handleViewActivity}>
            <View style={styles.activityButtonContent}>
              <IconSymbol name="calendar" size={22} color={colors.primary} />
              <Text style={styles.activityButtonText}>Voir l'activité</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Section membres */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membres</Text>
          <View style={styles.membersList}>
            {members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={styles.memberItem}
                onPress={() => handleMemberPress(member)}
                disabled={member.isCurrentUser}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: member.avatar || 'https://via.placeholder.com/50' }}
                  style={styles.memberAvatar}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.name}
                    {member.isCurrentUser && ' (vous)'}
                  </Text>
                </View>
                {!member.isCurrentUser && (
                  <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveGroup}
            disabled={leaving}
          >
            {leaving ? (
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <>
                <IconSymbol name="arrow.right.square" size={22} color="#FF3B30" />
                <Text style={styles.leaveButtonText}>
                  {groupInfo.activityId ? 'Quitter le groupe et l\'activité' : 'Quitter le groupe'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  activityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
  },
  activityButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  membersList: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.border,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
    paddingVertical: 16,
    borderRadius: 12,
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  bottomSpacer: {
    height: 40,
  },
  viewActivityButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.primary,
  paddingVertical: 14,
  paddingHorizontal: 24,
  borderRadius: 12,
  marginTop: 16,
  gap: 10,
},
viewActivityButtonText: {
  color: colors.background,
  fontSize: 16,
  fontWeight: '600',
},
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
    color: colors.textSecondary,
    marginBottom: 16,
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