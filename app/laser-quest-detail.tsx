// app/laser-quest-detail.tsx
// Page 100% dynamique connectée à Supabase

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
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';

// Configuration Supabase
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export default function LaserQuestDetailScreen() {
  const router = useRouter();
  const [isJoined, setIsJoined] = useState(false);
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Charger l'activité depuis Supabase avec les infos du host
  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    try {
      // Requête pour récupérer l'activité avec les infos du profil du host
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/activities?nom=eq.Laser Quest Adventure&select=*,profiles:host_id(full_name,avatar_url,city)`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const activityData = data[0];
          const hostProfile = activityData.profiles;
          
          // Formater les données pour l'affichage
          setActivity({
            id: activityData.id,
            title: activityData.nom,
            subtitle: activityData.titre,
            description: activityData.description,
            image: activityData.image_url,
            host: {
              id: activityData.host_id,
              name: hostProfile?.full_name || 'Organisateur',
              avatar: hostProfile?.avatar_url || 'https://images.unsplash.com/photo-1614294148960-9aa740632a87?w=400',
              type: activityData.host_type,
              city: hostProfile?.city,
              rating: 4.8, // TODO: À implémenter avec un système de notation
              reviews: 156, // TODO: À implémenter avec un système d'avis
            },
            date: activityData.date,
            time: activityData.time_start && activityData.time_end 
              ? `${activityData.time_start.slice(0, 5)} - ${activityData.time_end.slice(0, 5)}`
              : '17:00 - 20:00',
            nextDates: activityData.dates_supplementaires 
              ? activityData.dates_supplementaires.split(', ')
              : [],
            location: activityData.adresse,
            city: `${activityData.ville} ${activityData.code_postal || ''}`.trim(),
            capacity: activityData.max_participants,
            participants: activityData.participants,
            placesRestantes: activityData.places_restantes,
            category: activityData.categorie,
            price: activityData.prix 
              ? `€${activityData.prix.toFixed(2)}`
              : 'Gratuit',
            includes: activityData.inclusions || [],
            rules: activityData.regles || []
          });
        }
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

      // Mettre à jour le nombre de participants dans Supabase
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
            style={styles.backButton}
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
          {/* Section Titre */}
          <View style={styles.titleSection}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{activity.title}</Text>
              {activity.subtitle && (
                <Text style={styles.subtitle}>{activity.subtitle}</Text>
              )}
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: '#ef4444' + '20' }]}>
              <Text style={[styles.categoryText, { color: '#ef4444' }]}>
                {activity.category}
              </Text>
            </View>
          </View>

          {/* Section Hôte (Organisateur) */}
          <TouchableOpacity style={styles.hostSection}>
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
          </TouchableOpacity>

          {/* Section Prix */}
          {activity.price !== 'Gratuit' && (
            <View style={styles.priceSection}>
              <Text style={styles.priceLabel}>Tarif par personne</Text>
              <Text style={styles.priceValue}>{activity.price}</Text>
            </View>
          )}

          {/* Carte Détails */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={22} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Prochaine session</Text>
                <Text style={styles.detailValue}>{activity.date}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="clock.fill" size={22} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Horaires</Text>
                <Text style={styles.detailValue}>{activity.time}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="location.fill" size={22} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Lieu</Text>
                <Text style={styles.detailValue}>
                  {activity.location}, {activity.city}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="person.2.fill" size={22} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Places disponibles</Text>
                <Text style={styles.detailValue}>
                  {activity.participants}/{activity.capacity} inscrits ({activity.placesRestantes} places restantes)
                </Text>
              </View>
            </View>
          </View>

          {/* Prochaines dates */}
          {activity.nextDates.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prochaines dates disponibles</Text>
              <View style={styles.datesContainer}>
                {activity.nextDates.map((date: string, index: number) => (
                  <View key={index} style={styles.dateChip}>
                    <Text style={styles.dateChipText}>{date}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <Text style={styles.description}>{activity.description}</Text>
          </View>

          {/* Ce qui est inclus */}
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

          {/* Section Participants */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Participants ({activity.participants})
            </Text>
            {activity.participants === 0 ? (
              <View style={styles.emptyParticipants}>
                <IconSymbol name="person.2" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyParticipantsText}>
                  Soyez le premier à rejoindre cette activité !
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

      {/* Footer avec bouton d'action */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerPrice}>{activity.price}</Text>
          <Text style={styles.footerPriceLabel}>par personne</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.actionButton, 
            isJoined && styles.actionButtonLeave,
            isFull && !isJoined && styles.actionButtonDisabled
          ]}
          onPress={handleJoinLeave}
          disabled={isFull && !isJoined}
        >
          <Text style={styles.actionButtonText}>
            {isFull && !isJoined ? 'Complet' : isJoined ? 'Se désinscrire' : 'Réserver'}
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
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 36,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
  },
  hostInfo: {
    flex: 1,
  },
  hostLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  hostName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  hostCity: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  enterpriseBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  enterpriseBadgeText: {
    fontSize: 11,
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
    fontSize: 28,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipText: {
    fontSize: 14,
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
    paddingVertical: 40,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  emptyParticipantsText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
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
    fontSize: 16,
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  footerPriceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 160,
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
  backButton: {
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