// app/laser-quest-detail.tsx
// Créez ce nouveau fichier dans votre dossier app/

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';

export default function LaserQuestDetailScreen() {
  const router = useRouter();
  const [isJoined, setIsJoined] = useState(false);

  const activity = {
    id: 'laser-quest-1',
    title: 'Laser Quest Adventure',
    subtitle: 'LASER GAME KARAOKE',
    description: 'Vivez une expérience immersive unique avec notre arène de laser game dernière génération ! Équipez-vous, formez votre équipe et affrontez vos adversaires dans un décor futuriste. Session suivie d\'un karaoke pour prolonger la soirée entre amis.\n\nParfait pour les groupes, anniversaires, et événements d\'entreprise. Matériel professionnel fourni, vestiaires sur place.',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800',
    host: {
      id: 'laser-quest-paris',
      name: 'Laser Quest Aventure Paris',
      avatar: 'https://images.unsplash.com/photo-1614294148960-9aa740632a87?w=400',
      type: 'Entreprise',
      rating: 4.8,
      reviews: 156,
    },
    date: '17 mai 2024',
    time: '17:00 - 20:00',
    nextDates: ['20 mai', '23 mai', '27 mai', '30 mai', '3 juin'],
    location: '7 Allée André Malraux',
    city: 'Le Plessis-Trevise 94420',
    capacity: 40,
    participants: 0,
    category: 'Laser game',
    price: '€15',
    includes: [
      'Équipement laser game complet',
      'Session de 45 minutes',
      'Accès au karaoke (1h)',
      'Vestiaires et casiers',
      'Boissons offertes'
    ],
    rules: [
      'Âge minimum : 8 ans',
      'Réservation obligatoire',
      'Chaussures de sport recommandées',
      'Annulation possible 24h avant'
    ]
  };

  const handleJoinLeave = () => {
    setIsJoined(!isJoined);
  };

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
              <Text style={styles.subtitle}>{activity.subtitle}</Text>
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: '#ef4444' + '20' }]}>
              <Text style={[styles.categoryText, { color: '#ef4444' }]}>
                {activity.category}
              </Text>
            </View>
          </View>

          {/* Section Hôte (Entreprise) */}
          <TouchableOpacity style={styles.hostSection}>
            <Image source={{ uri: activity.host.avatar }} style={styles.hostAvatar} />
            <View style={styles.hostInfo}>
              <Text style={styles.hostLabel}>Organisé par</Text>
              <Text style={styles.hostName}>{activity.host.name}</Text>
              <View style={styles.hostRating}>
                <IconSymbol name="star.fill" size={14} color="#F39C12" />
                <Text style={styles.ratingText}>
                  {activity.host.rating} ({activity.host.reviews} avis)
                </Text>
              </View>
            </View>
            <View style={styles.enterpriseBadge}>
              <Text style={styles.enterpriseBadgeText}>PRO</Text>
            </View>
          </TouchableOpacity>

          {/* Section Prix */}
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Tarif par personne</Text>
            <Text style={styles.priceValue}>{activity.price}</Text>
          </View>

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
                  {activity.participants}/{activity.capacity} inscrits
                </Text>
              </View>
            </View>
          </View>

          {/* Prochaines dates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prochaines dates disponibles</Text>
            <View style={styles.datesContainer}>
              {activity.nextDates.map((date, index) => (
                <View key={index} style={styles.dateChip}>
                  <Text style={styles.dateChipText}>{date}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <Text style={styles.description}>{activity.description}</Text>
          </View>

          {/* Ce qui est inclus */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ce qui est inclus</Text>
            {activity.includes.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <IconSymbol name="checkmark.circle.fill" size={20} color="#10b981" />
                <Text style={styles.listItemText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Règles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations importantes</Text>
            {activity.rules.map((rule, index) => (
              <View key={index} style={styles.listItem}>
                <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
                <Text style={styles.listItemText}>{rule}</Text>
              </View>
            ))}
          </View>

          {/* Section Participants (vide pour l'instant) */}
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
            ) : null}
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
          style={[styles.actionButton, isJoined && styles.actionButtonLeave]}
          onPress={handleJoinLeave}
        >
          <Text style={styles.actionButtonText}>
            {isJoined ? 'Se désinscrire' : 'Réserver'}
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
    marginBottom: 4,
  },
  hostRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
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
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});