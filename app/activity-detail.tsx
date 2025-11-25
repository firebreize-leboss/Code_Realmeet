// app/activity-detail.tsx
// Remplacez le contenu du fichier existant par celui-ci

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';

// Configuration Supabase
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [isJoined, setIsJoined] = useState(false);
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  if (id) {
    loadActivity();
  }
}, [id]);

const loadActivity = async () => {
  // ⚠️ id peut être string | string[]
  const activityId = Array.isArray(id) ? id[0] : id;

  if (!activityId) {
    setLoading(false);
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/activities?id=eq.${activityId}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Erreur Supabase détail:', await response.text());
      setLoading(false);
      return;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const activityData = data[0];

      setActivity({
        id: activityData.id,
        title: activityData.nom,
        subtitle: activityData.titre,
        description: activityData.description,
        image: activityData.image_url,
        host: {
          id: activityData.host_id,
          // on met des valeurs par défaut (tu pourras refaire une vraie jointure plus tard)
          name: 'Organisateur',
          avatar: 'https://via.placeholder.com/400',
          type: activityData.host_type,
          city: activityData.ville,
        },
        date: activityData.date,
        time:
          activityData.time_start && activityData.time_end
            ? `${activityData.time_start.slice(0, 5)} - ${activityData.time_end.slice(0, 5)}`
            : 'Horaires à confirmer',
        location: activityData.adresse,
        city: `${activityData.ville} ${activityData.code_postal || ''}`.trim(),
        capacity: activityData.max_participants,
        participants: activityData.participants,
        placesRestantes: activityData.places_restantes,
        category: activityData.categorie,
        price: activityData.prix > 0 ? `€${activityData.prix.toFixed(2)}` : 'Gratuit',
        includes: activityData.inclusions || [],
        rules: activityData.regles || [],
        nextDates: activityData.dates_supplementaires
          ? activityData.dates_supplementaires.split(', ')
          : [],
      });
    } else {
      console.log('Aucune activité trouvée pour id', activityId);
    }
  } catch (error) {
    console.error('Erreur chargement activité:', error);
  } finally {
    setLoading(false);
  }
};

  const handleJoinLeave = async () => {
    if (!activity) return;

    try {
      const newParticipants = isJoined 
        ? activity.participants - 1 
        : activity.participants + 1;

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/activities?id=eq.${activity.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            participants: newParticipants
          })
        }
      );

      if (response.ok) {
        setIsJoined(!isJoined);
        setActivity({
          ...activity,
          participants: newParticipants,
          placesRestantes: activity.capacity - newParticipants
        });
      }
    } catch (error) {
      console.error('Erreur mise à jour participants:', error);
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

  const isFull = activity.placesRestantes === 0;

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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: activity.image }} style={styles.heroImage} />

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{activity.title}</Text>
              {activity.subtitle && (
                <Text style={styles.subtitle}>{activity.subtitle}</Text>
              )}
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>
          </View>

          <View style={styles.hostSection}>
            <Image source={{ uri: activity.host.avatar }} style={styles.hostAvatar} />
            <View style={styles.hostInfo}>
              <Text style={styles.hostLabel}>Organisé par</Text>
              <Text style={styles.hostName}>{activity.host.name}</Text>
              {activity.host.city && (
                <Text style={styles.hostCity}>{activity.host.city}</Text>
              )}
            </View>
            {activity.host.type === 'Entreprise' && (
              <View style={styles.enterpriseBadge}>
                <Text style={styles.enterpriseBadgeText}>PRO</Text>
              </View>
            )}
          </View>

          {activity.price !== 'Gratuit' && (
            <View style={styles.priceSection}>
              <Text style={styles.priceLabel}>Tarif par personne</Text>
              <Text style={styles.priceValue}>{activity.price}</Text>
            </View>
          )}

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={20} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{activity.date}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="clock.fill" size={20} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Horaires</Text>
                <Text style={styles.detailValue}>{activity.time}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="location.fill" size={20} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Lieu</Text>
                <Text style={styles.detailValue}>
                  {activity.location}, {activity.city}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="person.2.fill" size={20} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Capacité</Text>
                <Text style={styles.detailValue}>
                  {activity.participants} / {activity.capacity} inscrits
                </Text>
              </View>
            </View>
          </View>

          {activity.nextDates.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prochaines dates</Text>
              <View style={styles.datesContainer}>
                {activity.nextDates.map((date: string, index: number) => (
                  <View key={index} style={styles.dateChip}>
                    <Text style={styles.dateChipText}>{date}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

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
                  {activity.participants} {activity.participants === 1 ? 'personne inscrite' : 'personnes inscrites'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerPrice}>{activity.price}</Text>
          <Text style={styles.footerLabel}>par personne</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isJoined && styles.actionButtonLeave,
            isFull && !isJoined && styles.actionButtonDisabled,
          ]}
          onPress={handleJoinLeave}
          disabled={isFull && !isJoined}
        >
          <Text style={styles.actionButtonText}>
            {isFull && !isJoined ? 'Complet' : isJoined ? 'Se désinscrire' : 'Rejoindre'}
          </Text>
        </TouchableOpacity>
      </View>
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
  hostLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  hostCity: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  enterpriseBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  enterpriseBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.background,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  datesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  emptyParticipants: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  emptyParticipantsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
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
    fontWeight: '500',
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  footerInfo: {
    flex: 1,
  },
  footerPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  footerLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  backButtonError: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});