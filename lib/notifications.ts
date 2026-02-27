// lib/notifications.ts
// Service de gestion des notifications push

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';

// Configuration du handler de notifications (désactivé en dev car Expo Go ne supporte plus les push)
// Wrappé dans un try/catch pour éviter les erreurs avec Expo Go SDK 53
try {
  if (!__DEV__ && Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (error) {
  console.log('⚠️ Notifications handler not available (expected in Expo Go)');
}

export interface PushNotificationData {
  type: 'message' | 'friend_request' | 'activity';
  conversationId?: string;
  requestId?: string;
  activityId?: string;
}

class NotificationService {
  private responseListener: Notifications.Subscription | null = null;
  private receivedListener: Notifications.Subscription | null = null;

  /**
   * Initialise les listeners de notifications
   * À appeler dans _layout.tsx
   */
  async initialize(): Promise<void> {
    // Listener quand l'utilisateur tape sur une notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('📱 Notification tapped:', response);
        this.handleNotificationTap(response.notification.request.content.data as PushNotificationData);
      }
    );

    // Listener quand une notification est reçue en foreground
    this.receivedListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        // Ignorer les push de type activity_cancelled (géré par le Realtime listener)
        if (notification.request.content.data?.type === 'activity_cancelled') {
          return;
        }
        console.log('📬 Notification received:', notification);
      }
    );

    // Vérifier si l'app a été ouverte via une notification
    const lastNotification = await Notifications.getLastNotificationResponseAsync();
    if (lastNotification) {
      console.log('📱 App opened from notification:', lastNotification);
      this.handleNotificationTap(
        lastNotification.notification.request.content.data as PushNotificationData
      );
    }
  }

  /**
   * Nettoie les listeners
   */
  cleanup(): void {
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    if (this.receivedListener) {
      Notifications.removeNotificationSubscription(this.receivedListener);
    }
  }

  /**
   * Gère le tap sur une notification -> navigation
   */
  private handleNotificationTap(data: PushNotificationData): void {
    if (!data) return;

    switch (data.type) {
      case 'message':
        if (data.conversationId) {
          router.push(`/chat-detail?id=${data.conversationId}`);
        }
        break;
      case 'friend_request':
        router.push('/(tabs)/inbox');
        break;
      case 'activity':
        if (data.activityId) {
          router.push(`/activity-detail?id=${data.activityId}`);
        }
        break;
    }
  }

  /**
   * Demande les permissions et enregistre le token
   */
  async registerForPushNotifications(): Promise<string | null> {
    // Vérifier si c'est un device physique
    if (!Device.isDevice) {
      console.log('⚠️ Push notifications require a physical device');
      return null;
    }

    // Désactiver en mode développement (Expo Go ne supporte plus les push)
    if (__DEV__) {
      console.log('⚠️ Push notifications disabled in development mode (Expo Go)');
      return null;
    }

    try {
      // Vérifier les permissions existantes
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Demander les permissions si pas encore accordées
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permission denied');
        return null;
      }

      // Obtenir le token Expo Push
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '06abc2ef-75a1-4994-b48c-146eb6f5d87f', // Remplacer par ton projectId EAS
      });

      const token = tokenData.data;
      console.log('✅ Expo Push Token:', token);

      // Configuration Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // Sauvegarder le token dans Supabase
      await this.saveTokenToDatabase(token);

      return token;
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Sauvegarde le token dans le profil utilisateur
   */
  private async saveTokenToDatabase(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          expo_push_token: token,
          notifications_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      console.log('✅ Push token saved to database');
    } catch (error) {
      console.error('❌ Error saving push token:', error);
    }
  }

  /**
   * Supprime le token (désactivation des notifications)
   */
  async unregisterPushNotifications(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          expo_push_token: null,
          notifications_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      console.log('✅ Push token removed from database');
    } catch (error) {
      console.error('❌ Error removing push token:', error);
    }
  }

  /**
   * Vérifie si les notifications sont activées
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('profiles')
        .select('notifications_enabled, expo_push_token')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data?.notifications_enabled === true && !!data?.expo_push_token;
    } catch (error) {
      console.error('Error checking notification status:', error);
      return false;
    }
  }

  /**
   * Toggle les notifications
   */
  async toggleNotifications(enabled: boolean): Promise<boolean> {
    if (enabled) {
      const token = await this.registerForPushNotifications();
      return !!token;
    } else {
      await this.unregisterPushNotifications();
      return true;
    }
  }
}

export const notificationService = new NotificationService();