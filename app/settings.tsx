import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { notificationService } from '@/lib/notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [locationEnabled, setLocationEnabled] = React.useState(true);
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
        <IconSymbol name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showChevron && (
        <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  const SettingToggle = ({
    icon,
    title,
    subtitle,
    value,
    onValueChange,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <IconSymbol name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.text}
      />
    </View>
  );

  const handleLogout = async () => {
    const result = await authService.logoutUser();
    if (result.success) {
      router.push('/auth/account-type');
    } else {
      Alert.alert('Erreur', result.error);
    }
  };

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <SettingItem
              icon="person.fill"
              title="Edit Profile"
              subtitle="Update your personal information"
              onPress={() => router.push('/edit-profile')}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="lock.fill"
              title="Privacy"
              subtitle="Manage your privacy settings"
              onPress={() => console.log('Privacy')}
            />
            <SettingItem
              icon="nosign"
              title="Utilisateurs bloqués"
              subtitle="Gérer les personnes bloquées"
              onPress={() => router.push('/blocked-users')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <SettingItem
              icon="location.fill"
              title="Distance"
              subtitle="Set your search radius"
              onPress={() => console.log('Distance')}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="square.stack.3d.up.fill"
              title="Categories"
              subtitle="Choose your interests"
              onPress={() => console.log('Categories')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <SettingToggle
              icon="bell.fill"
              title="Push Notifications"
              subtitle="Get notified about new activities"
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
            />
            <View style={styles.divider} />
            <SettingToggle
              icon="location.fill"
              title="Location Services"
              subtitle="Find activities near you"
              value={locationEnabled}
              onValueChange={setLocationEnabled}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <SettingItem
              icon="info.circle.fill"
              title="Help & Support"
              onPress={() => console.log('Help')}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="doc.text.fill"
              title="Terms of Service"
              onPress={() => console.log('Terms')}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="shield.fill"
              title="Privacy Policy"
              onPress={() => console.log('Privacy Policy')}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  logoutButton: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});