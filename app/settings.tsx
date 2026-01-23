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
import { colors } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { notificationService } from '@/lib/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

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
      <View style={styles.settingIcon}>
        <IconSymbol name={icon} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showChevron && (
        <IconSymbol name="chevron.right" size={18} color="rgba(255,255,255,0.7)" />
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
      <View style={styles.settingIcon}>
        <IconSymbol name={icon} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.5)' }}
          thumbColor={value ? '#FFFFFF' : 'rgba(255,255,255,0.8)'}
          ios_backgroundColor="rgba(255,255,255,0.3)"
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

      console.log('Delete account response:', response);

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
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Compte */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compte</Text>
            <View style={styles.glassCard}>
              <SettingItem
                icon="person.fill"
                title="Modifier le profil"
                subtitle="Mettre à jour vos informations"
                onPress={() => router.push('/edit-profile')}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="lock.fill"
                title="Confidentialité"
                subtitle="Gérer vos paramètres de confidentialité"
                onPress={() => console.log('Privacy')}
              />
              <View style={styles.divider} />
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
            <Text style={styles.sectionTitle}>Préférences</Text>
            <View style={styles.glassCard}>
              <SettingItem
                icon="location.fill"
                title="Distance"
                subtitle="Définir votre rayon de recherche"
                onPress={() => console.log('Distance')}
              />
              <View style={styles.divider} />
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
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.glassCard}>
              <SettingToggle
                icon="bell.fill"
                title="Notifications push"
                subtitle="Recevoir des alertes pour les nouvelles activités"
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                loading={notificationsLoading}
              />
              <View style={styles.divider} />
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
            <Text style={styles.sectionTitle}>À propos</Text>
            <View style={styles.glassCard}>
              <SettingItem
                icon="info.circle.fill"
                title="Aide & Support"
                onPress={() => console.log('Help')}
              />
              <View style={styles.divider} />
              <SettingItem
                icon="doc.text.fill"
                title="Conditions d'utilisation"
                onPress={() => console.log('Terms')}
              />
              <View style={styles.divider} />
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
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="#FFFFFF" />
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
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="trash.fill" size={20} color="#FFFFFF" />
                <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Version */}
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginLeft: 72,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.8)',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 24,
    marginBottom: 20,
  },
});
