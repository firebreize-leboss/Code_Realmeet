import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { notificationService } from '@/lib/notifications';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = React.useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Charger l'état initial des notifications
  React.useEffect(() => {
    const loadNotificationStatus = async () => {
      const enabled = await notificationService.areNotificationsEnabled();
      setNotificationsEnabled(enabled);
      setNotificationsLoading(false);
    };
    loadNotificationStatus();
  }, []);

  // Handler pour le toggle notifications
  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsLoading(true);
    try {
      // En mode dev, informer l'utilisateur
      if (__DEV__) {
        Alert.alert(
          'Mode développement',
          'Les notifications push ne sont pas disponibles avec Expo Go. Elles fonctionneront dans la version finale de l\'app.'
        );
        setNotificationsLoading(false);
        return;
      }

      const success = await notificationService.toggleNotifications(value);
      if (success) {
        setNotificationsEnabled(value);
        Alert.alert(
          'Succès',
          value ? 'Notifications activées' : 'Notifications désactivées'
        );
      } else {
        Alert.alert(
          'Erreur',
          'Impossible de modifier les notifications. Vérifiez les permissions dans les réglages de votre téléphone.'
        );
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    showChevron = true,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showChevron?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingIconContainer}>
        <IconSymbol name={icon} size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showChevron && (
        <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  const SettingToggle = ({
    icon,
    title,
    subtitle,
    value,
    onValueChange,
    loading = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    loading?: boolean;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIconContainer}>
        <IconSymbol name={icon} size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.borderLight, true: colors.primaryMuted }}
          thumbColor={value ? colors.primary : colors.textMuted}
          ios_backgroundColor={colors.borderLight}
        />
      )}
    </View>
  );

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Supprimer mon compte',
      'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible et toutes vos données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    Alert.alert(
      'Confirmation finale',
      'Dernière chance ! Voulez-vous vraiment supprimer votre compte et toutes vos données ?',
      [
        { text: 'Non, annuler', style: 'cancel' },
        {
          text: 'Oui, supprimer définitivement',
          style: 'destructive',
          onPress: executeDeleteAccount,
        },
      ]
    );
  };

  const executeDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Non authentifié');
      }

      const response = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la suppression');
      }

      if (response.data?.error) {
        throw new Error(response.data.error + (response.data.details ? `: ${response.data.details}` : ''));
      }
      // Déconnexion et redirection
      await authService.logoutUser();
      Alert.alert(
        'Compte supprimé',
        'Votre compte a été supprimé avec succès.',
        [{ text: 'OK', onPress: () => router.replace('/auth/account-type') }]
      );
    } catch (error: any) {
      console.error('Erreur suppression compte:', error);
      Alert.alert('Erreur', error.message || 'Impossible de supprimer le compte');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      // Utiliser signOut du contexte pour réinitialiser l'état global
      await signOut();
      // Le guard dans (tabs)/_layout.tsx redirigera automatiquement vers /auth/account-type
      // Mais on utilise aussi replace pour s'assurer que l'historique est nettoyé
      router.replace('/auth/account-type');
    } catch (error: any) {
      console.error('Erreur déconnexion:', error);
      Alert.alert('Erreur', 'Impossible de se déconnecter. Veuillez réessayer.');
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Compte */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COMPTE</Text>
            <View style={styles.sectionCard}>
              <SettingItem
                icon="person.fill"
                title="Modifier le profil"
                subtitle="Mettre à jour vos informations"
                onPress={() => router.push('/edit-profile')}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="lock.fill"
                title="Confidentialité"
                subtitle="Gérer vos paramètres de confidentialité"
                onPress={() => console.log('Privacy')}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="nosign"
                title="Utilisateurs bloqués"
                subtitle="Gérer les personnes bloquées"
                onPress={() => router.push('/blocked-users')}
              />
            </View>
          </View>

          {/* Section Préférences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRÉFÉRENCES</Text>
            <View style={styles.sectionCard}>
              <SettingItem
                icon="location.fill"
                title="Distance"
                subtitle="Définir votre rayon de recherche"
                onPress={() => console.log('Distance')}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="square.stack.3d.up.fill"
                title="Catégories"
                subtitle="Choisir vos centres d'intérêt"
                onPress={() => console.log('Categories')}
              />
            </View>
          </View>

          {/* Section Notifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
            <View style={styles.sectionCard}>
              <SettingToggle
                icon="bell.fill"
                title="Notifications push"
                subtitle="Recevoir des alertes pour les nouvelles activités"
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                loading={notificationsLoading}
              />
              <View style={styles.separator} />
              <SettingToggle
                icon="location.fill"
                title="Services de localisation"
                subtitle="Trouver des activités près de vous"
                value={locationEnabled}
                onValueChange={setLocationEnabled}
              />
            </View>
          </View>

          {/* Section À propos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À PROPOS</Text>
            <View style={styles.sectionCard}>
              <SettingItem
                icon="info.circle.fill"
                title="Aide & Support"
                onPress={() => console.log('Help')}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="doc.text.fill"
                title="Conditions d'utilisation"
                onPress={() => console.log('Terms')}
              />
              <View style={styles.separator} />
              <SettingItem
                icon="shield.fill"
                title="Politique de confidentialité"
                onPress={() => console.log('Privacy Policy')}
              />
            </View>
          </View>

          {/* Bouton Déconnexion */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={logoutLoading}
            activeOpacity={0.8}
          >
            {logoutLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color={colors.primary} />
                <Text style={styles.logoutText}>Se déconnecter</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Bouton Supprimer compte */}
          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
            activeOpacity={0.8}
          >
            {deleteLoading ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <IconSymbol name="trash.fill" size={18} color={colors.error} />
                <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Version */}
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
    marginBottom: 1,
  },
  settingSubtitle: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
    marginLeft: 68,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  logoutText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  deleteAccountText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.error,
  },
  versionText: {
    textAlign: 'center',
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textMuted,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
});
