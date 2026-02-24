// contexts/DataCacheContext.tsx
// Système de cache global OPTIMISÉ pour performances haute latence
// Version 2.0 - Patch Performance La Réunion
// Élimine les patterns N+1 et regroupe les requêtes via RPC

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { blockService } from '@/services/block.service';

// ============================================
// TYPES
// ============================================

interface Activity {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  categorie2?: string;
  image_url?: string;
  date: string;
  time_start?: string;
  adresse: string;
  ville: string;
  latitude: number;
  longitude: number;
  participants: number;
  max_participants: number;
  host_id: string;
  prix?: number;
  status: string;
  created_at: string;
  // Données agrégées des slots
  slot_count?: number;
  next_slot_date?: string;
  total_remaining_places?: number;
}

interface Conversation {
  id: string;
  name: string;
  image: string;
  lastMessage: string;
  lastMessageTime: string;
  isGroup: boolean;
  unreadCount: number;
  activityId?: string | null;
  slotId?: string | null;
  isActivityGroup?: boolean;
  isPastActivity?: boolean;
  slotDate?: string;
  slotTime?: string;
  updated_at: string;
  participantCount?: number;
  isMuted?: boolean;
}

interface Friend {
  friend_id: string;
  full_name: string;
  avatar_url: string;
  city: string;
  created_at: string;
}

interface SlotData {
  latestDate: string | null;
  slotCount: number;
  remainingPlaces: number;
  totalMaxPlaces: number;
  allDates: string[];
}

interface CacheData {
  activities: Activity[];
  myActivities: Activity[];
  conversations: Conversation[];
  friends: Friend[];
  slotDataByActivity: Record<string, SlotData>;
}

interface DataCacheContextType {
  cache: CacheData;
  loading: boolean;
  lastUpdate: number;

  // Méthodes de chargement
  loadAllData: () => Promise<void>;
  refreshActivities: () => Promise<void>;
  refreshMyActivities: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  refreshBlockedUsers: () => Promise<void>;

  // Méthodes de mise à jour locale
  updateActivityInCache: (activityId: string, updates: Partial<Activity>) => void;
  addConversationToCache: (conversation: Conversation) => void;
  updateConversationInCache: (conversationId: string, updates: Partial<Conversation>) => void;
  markConversationAsRead: (conversationId: string) => void;
  removeConversationFromCache: (conversationId: string) => void;
  toggleMuteConversation: (conversationId: string) => Promise<boolean>;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

// ============================================
// HELPER: Format de l'heure relative
// ============================================

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';

  const msgDate = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return msgDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays < 7) {
    return msgDate.toLocaleDateString('fr-FR', { weekday: 'short' });
  } else {
    return msgDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }
}

// ============================================
// HELPER: Format du dernier message
// ============================================

function formatLastMessage(content: string | null, messageType: string | null): string {
  if (!content && !messageType) return '';

  if (messageType === 'image') return '📷 Photo';
  if (messageType === 'voice') return '🎤 Message vocal';
  if (messageType === 'system') return content || '';

  return content || '';
}

// ============================================
// PROVIDER
// ============================================

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cache, setCache] = useState<CacheData>({
    activities: [],
    myActivities: [],
    conversations: [],
    friends: [],
    slotDataByActivity: {},
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const isInitialLoad = useRef(true);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  // ============================================
  // CHARGEMENT DES ACTIVITÉS (OPTIMISÉ via RPC)
  // 1 seule requête au lieu de 3
  // ============================================

  const loadActivitiesFallback = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const activities = data || [];
      const ids = activities.map(a => a.id);
      const todayStr = new Date().toISOString().split('T')[0];

      // Récupérer les slots (on récupère ceux d'aujourd'hui et futurs, puis on filtre par heure côté client)
      const { data: slots } = await supabase
        .from('activity_slots')
        .select('id, activity_id, date, time, duration, max_participants')
        .in('activity_id', ids.length > 0 ? ids : ['__none__'])
        .gte('date', todayStr)
        .order('date', { ascending: true });

      // Filtrer : garder uniquement les créneaux dont le début est dans plus de 24h
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const filteredSlots = (slots || []).filter(s => {
        const slotDate = s.date; // Format YYYY-MM-DD
        const timeStr = s.time;
        const startDateTime = timeStr
          ? new Date(`${slotDate}T${timeStr}`)
          : new Date(`${slotDate}T23:59:59`); // fallback fin de journée

        return startDateTime > twentyFourHoursFromNow;
      });

      const slotIds = filteredSlots.map(s => s.id);

      // Récupérer les participants
      const { data: slotParticipants } = await supabase
        .from('slot_participants')
        .select('slot_id, activity_id')
        .in('slot_id', slotIds.length > 0 ? slotIds : ['__none__'])
        .eq('status', 'active');

      // Calculer les données par activité
      const participantsBySlot: Record<string, number> = {};
      (slotParticipants || []).forEach(sp => {
        participantsBySlot[sp.slot_id] = (participantsBySlot[sp.slot_id] || 0) + 1;
      });

      const slotDataByActivity: Record<string, SlotData> = {};

      ids.forEach(id => {
        slotDataByActivity[id] = { latestDate: null, slotCount: 0, remainingPlaces: 0, totalMaxPlaces: 0, allDates: [] };
      });

      filteredSlots.forEach(s => {
        if (!slotDataByActivity[s.activity_id].latestDate) {
          slotDataByActivity[s.activity_id].latestDate = s.date;
        }
        // Ajouter la date si elle n'existe pas déjà (dates uniques)
        if (!slotDataByActivity[s.activity_id].allDates.includes(s.date)) {
          slotDataByActivity[s.activity_id].allDates.push(s.date);
        }
        slotDataByActivity[s.activity_id].slotCount++;

        const slotCapacity = s.max_participants || 10;
        const slotParticipantCount = participantsBySlot[s.id] || 0;
        const slotRemaining = Math.max(0, slotCapacity - slotParticipantCount);
        slotDataByActivity[s.activity_id].remainingPlaces += slotRemaining;
        slotDataByActivity[s.activity_id].totalMaxPlaces += slotCapacity;
      });

      // Filtrer les activités avec au moins un créneau futur
      const activitiesWithSlots = activities.filter(a => slotDataByActivity[a.id]?.latestDate !== null);

      setCache(prev => ({
        ...prev,
        activities: activitiesWithSlots,
        slotDataByActivity
      }));
    } catch (error) {
      console.error('Error loading activities (fallback):', error);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      // Utiliser la RPC optimisée qui retourne tout en une requête
      const { data, error } = await supabase.rpc('get_activities_with_slots', {
        p_status: 'active',
        p_limit: 100
      });

      if (error) {
        console.error('RPC get_activities_with_slots error:', error);
        // Fallback vers l'ancienne méthode si RPC n'existe pas encore
        await loadActivitiesFallback();
        return;
      }

      const activities: Activity[] = (data || []).map((a: any) => ({
        id: a.activity_id,
        nom: a.nom,
        description: a.description,
        categorie: a.categorie,
        categorie2: a.categorie2,
        image_url: a.image_url,
        date: a.date,
        time_start: a.time_start,
        adresse: a.adresse,
        ville: a.ville,
        latitude: a.latitude,
        longitude: a.longitude,
        participants: a.participants,
        max_participants: a.max_participants,
        host_id: a.host_id,
        prix: a.prix,
        status: a.status,
        created_at: a.created_at,
        slot_count: a.slot_count,
        next_slot_date: a.next_slot_date,
        total_remaining_places: a.total_remaining_places,
      }));

      const activityIds = activities.map(a => a.id);
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();

      // Récupérer toutes les dates uniques et max_participants des slots futurs pour chaque activité
      // On inclut aussi l'id pour pouvoir fetch les participants
      const { data: slotsData } = await supabase
        .from('activity_slots')
        .select('id, activity_id, date, time, duration, max_participants')
        .in('activity_id', activityIds.length > 0 ? activityIds : ['__none__'])
        .gte('date', todayStr)
        .order('date', { ascending: true });

      // Filtrer : garder uniquement les créneaux dont le début est dans plus de 24h
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const filteredSlotsData = (slotsData || []).filter(s => {
        const slotDate = s.date;
        const timeStr = s.time;
        const startDateTime = timeStr
          ? new Date(`${slotDate}T${timeStr}`)
          : new Date(`${slotDate}T23:59:59`);

        return startDateTime > twentyFourHoursFromNow;
      });

      // Récupérer les slot IDs filtrés pour fetch les participants
      const filteredSlotIds = filteredSlotsData.map(s => s.id);

      // Fetch les participants pour les slots filtrés
      const { data: slotParticipants } = await supabase
        .from('slot_participants')
        .select('slot_id')
        .in('slot_id', filteredSlotIds.length > 0 ? filteredSlotIds : ['__none__'])
        .eq('status', 'active');

      // Calculer le nombre de participants par slot
      const participantsBySlot: Record<string, number> = {};
      (slotParticipants || []).forEach(sp => {
        participantsBySlot[sp.slot_id] = (participantsBySlot[sp.slot_id] || 0) + 1;
      });

      // Grouper les dates uniques et calculer totalMaxPlaces + remainingPlaces par activité
      const datesByActivity: Record<string, string[]> = {};
      const totalMaxPlacesByActivity: Record<string, number> = {};
      const remainingPlacesByActivity: Record<string, number> = {};
      activityIds.forEach(id => {
        datesByActivity[id] = [];
        totalMaxPlacesByActivity[id] = 0;
        remainingPlacesByActivity[id] = 0;
      });
      filteredSlotsData.forEach(slot => {
        if (!datesByActivity[slot.activity_id].includes(slot.date)) {
          datesByActivity[slot.activity_id].push(slot.date);
        }
        const slotCapacity = slot.max_participants || 10;
        const slotParticipantCount = participantsBySlot[slot.id] || 0;
        totalMaxPlacesByActivity[slot.activity_id] += slotCapacity;
        remainingPlacesByActivity[slot.activity_id] += Math.max(0, slotCapacity - slotParticipantCount);
      });

      // Construire slotDataByActivity depuis les données filtrées côté client
      const slotDataByActivity: Record<string, SlotData> = {};
      const slotCountByActivity: Record<string, number> = {};

      // Compter les créneaux filtrés par activité
      filteredSlotsData.forEach(slot => {
        slotCountByActivity[slot.activity_id] = (slotCountByActivity[slot.activity_id] || 0) + 1;
      });

      activities.forEach(a => {
        const allDates = datesByActivity[a.id] || [];
        // Utiliser la première date des créneaux filtrés (triés par date croissante)
        const latestDate = allDates.length > 0 ? allDates[0] : null;

        slotDataByActivity[a.id] = {
          latestDate,
          slotCount: slotCountByActivity[a.id] || 0,
          remainingPlaces: remainingPlacesByActivity[a.id] || 0,
          totalMaxPlaces: totalMaxPlacesByActivity[a.id] || 0,
          allDates,
        };
      });

      // Filtrer les activités qui ont au moins un créneau futur
      const activitiesWithSlots = activities.filter(a => slotDataByActivity[a.id]?.latestDate !== null);

      setCache(prev => ({
        ...prev,
        activities: activitiesWithSlots,
        slotDataByActivity
      }));
    } catch (error) {
      console.error('Error loading activities:', error);
      // Fallback
      await loadActivitiesFallback();
    }
  }, [loadActivitiesFallback]);

  // ============================================
  // CHARGEMENT DES ACTIVITÉS DE L'UTILISATEUR
  // ============================================

  const loadMyActivities = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Essayer la RPC optimisée d'abord
      const { data, error } = await supabase.rpc('get_my_activities', {
        p_user_id: user.id
      });

      if (error) {
        console.error('RPC get_my_activities error:', error);
        // Fallback
        const { data: fallbackData } = await supabase
          .from('activities')
          .select('*')
          .eq('host_id', user.id)
          .order('date', { ascending: false });

        setCache(prev => ({ ...prev, myActivities: fallbackData || [] }));
        return;
      }

      const myActivities: Activity[] = (data || []).map((a: any) => ({
        id: a.activity_id,
        nom: a.nom,
        description: a.description,
        categorie: a.categorie,
        image_url: a.image_url,
        date: a.date,
        adresse: a.adresse,
        ville: a.ville,
        participants: a.participants,
        max_participants: a.max_participants,
        prix: a.prix,
        status: a.status,
        created_at: a.created_at,
        slot_count: a.slot_count,
        next_slot_date: a.next_slot_date,
        total_remaining_places: a.total_participants,
        latitude: 0,
        longitude: 0,
        host_id: user.id,
      }));

      setCache(prev => ({ ...prev, myActivities }));
    } catch (error) {
      console.error('Error loading my activities:', error);
    }
  }, [user]);

  // ============================================
  // CHARGEMENT DES CONVERSATIONS (FALLBACK)
  // ============================================

  const loadConversationsFallback = useCallback(async () => {
    if (!user?.id) return;

    try {
      const userId = user.id;

      // Récupérer les conversations de l'utilisateur (exclure les conversations cachées)
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at, is_muted')
        .eq('user_id', userId)
        .eq('is_hidden', false);

      const conversationIds = participantData?.map(p => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        setCache(prev => ({ ...prev, conversations: [] }));
        return;
      }

      const lastReadMap: Record<string, string | null> = {};
      const isMutedMap: Record<string, boolean> = {};
      participantData?.forEach(p => {
        lastReadMap[p.conversation_id] = p.last_read_at;
        isMutedMap[p.conversation_id] = p.is_muted || false;
      });

      // Récupérer les conversations avec participants
      const { data } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants!inner (
            user_id,
            profiles:user_id (
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      // Récupérer les derniers messages en une requête
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('conversation_id, content, message_type, created_at, sender_id')
        .in('conversation_id', conversationIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const lastMessageByConv: Record<string, any> = {};
      lastMessages?.forEach(msg => {
        if (!lastMessageByConv[msg.conversation_id]) {
          lastMessageByConv[msg.conversation_id] = msg;
        }
      });

      // Compter les messages non lus en une seule requête batch
      const unreadCounts: Record<string, number> = {};
      conversationIds.forEach(id => {
        unreadCounts[id] = 0;
      });

      // Requête batch pour unread - mieux que N requêtes
      const { data: allMessages } = await supabase
        .from('messages')
        .select('conversation_id, created_at, sender_id, message_type')
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .neq('message_type', 'system')
        .is('deleted_at', null);

      allMessages?.forEach(msg => {
        const lastReadAt = lastReadMap[msg.conversation_id];
        if (!lastReadAt || new Date(msg.created_at) > new Date(lastReadAt)) {
          unreadCounts[msg.conversation_id] = (unreadCounts[msg.conversation_id] || 0) + 1;
        }
      });

      const transformedConversations = data?.map(conv => {
        const participants = conv.conversation_participants as any[];
        const otherParticipant = participants.find(p => p.user_id !== userId);
        const lastMsg = lastMessageByConv[conv.id];

        const isActivityGroup = conv.is_group === true && (conv.activity_id !== null || conv.slot_id !== null);
        const isRegularGroup = conv.is_group === true && conv.activity_id === null && conv.slot_id === null;

        let displayName: string;
        let displayImage: string;
        let isGroup: boolean;

        if (isActivityGroup || isRegularGroup) {
          displayName = conv.name || 'Groupe';
          displayImage = conv.image_url || '';
          isGroup = true;
        } else {
          displayName = otherParticipant?.profiles?.full_name || 'Inconnu';
          displayImage = otherParticipant?.profiles?.avatar_url || '';
          isGroup = false;
        }

        return {
          id: conv.id,
          name: displayName,
          image: displayImage,
          lastMessage: formatLastMessage(lastMsg?.content, lastMsg?.message_type),
          lastMessageTime: formatRelativeTime(lastMsg?.created_at),
          isGroup: isGroup,
          activityId: conv.activity_id || null,
          slotId: conv.slot_id || null,
          isActivityGroup: isActivityGroup,
          participantCount: participants.length,
          updated_at: conv.updated_at,
          unreadCount: unreadCounts[conv.id] || 0,
          isPastActivity: false,
          isMuted: isMutedMap[conv.id] || false,
        };
      }) || [];

      setCache(prev => ({ ...prev, conversations: transformedConversations }));
    } catch (error) {
      console.error('Error loading conversations (fallback):', error);
    }
  }, [user]);

  // ============================================
  // CHARGEMENT DES CONVERSATIONS (OPTIMISÉ via RPC)
  // Élimine le pattern N+1 sur unread count et slot date
  // 1 seule requête au lieu de 3 + N + N
  // ============================================

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Utiliser la RPC optimisée qui retourne TOUT en une seule requête
      const { data, error } = await supabase.rpc('get_my_conversations_v2', {
        p_user_id: user.id
      });

      if (error) {
        console.error('RPC get_my_conversations_v2 error:', error);
        // Fallback vers l'ancienne méthode
        await loadConversationsFallback();
        return;
      }

      const conversations: Conversation[] = (data || []).map((conv: any) => {
        const isActivityGroup = conv.is_group === true && (conv.activity_id !== null || conv.slot_id !== null);

        // Nom et image d'affichage
        let displayName: string;
        let displayImage: string;

        if (conv.is_group) {
          displayName = conv.conversation_name || 'Groupe';
          displayImage = conv.conversation_image || '';
        } else {
          displayName = conv.other_participant_name || 'Inconnu';
          displayImage = conv.other_participant_avatar || '';
        }

        return {
          id: conv.conversation_id,
          name: displayName,
          image: displayImage,
          lastMessage: formatLastMessage(conv.last_message_content, conv.last_message_type),
          lastMessageTime: formatRelativeTime(conv.last_message_at),
          isGroup: conv.is_group || false,
          unreadCount: conv.unread_count || 0,
          activityId: conv.activity_id || null,
          slotId: conv.slot_id || null,
          isActivityGroup,
          isPastActivity: conv.is_past_activity || false,
          slotDate: conv.slot_date || null,
          slotTime: conv.slot_time || null,
          updated_at: conv.updated_at,
          participantCount: conv.participant_count || 0,
          isMuted: conv.is_muted || false,
        };
      });

      setCache(prev => ({ ...prev, conversations }));
    } catch (error) {
      console.error('Error loading conversations:', error);
      await loadConversationsFallback();
    }
  }, [user, loadConversationsFallback]);

  // ============================================
  // CHARGEMENT DES AMIS (FALLBACK)
  // ============================================

  const loadFriendsFallback = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id, created_at')
        .eq('user_id', user.id);

      if (!friendships || friendships.length === 0) {
        setCache(prev => ({ ...prev, friends: [] }));
        return;
      }

      const friendIds = friendships.map(f => f.friend_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city')
        .in('id', friendIds);

      const formatted = friendships.map(f => {
        const profile = profiles?.find(p => p.id === f.friend_id);
        return {
          friend_id: f.friend_id,
          full_name: profile?.full_name || 'Inconnu',
          avatar_url: profile?.avatar_url || '',
          city: profile?.city || '',
          created_at: f.created_at,
        };
      });

      setCache(prev => ({ ...prev, friends: formatted }));
    } catch (error) {
      console.error('Error loading friends (fallback):', error);
    }
  }, [user]);

  // ============================================
  // CHARGEMENT DES AMIS (OPTIMISÉ via RPC)
  // 1 seule requête au lieu de 2
  // ============================================

  const loadFriends = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Utiliser la RPC optimisée
      const { data, error } = await supabase.rpc('get_friends_with_profiles', {
        p_user_id: user.id
      });

      if (error) {
        console.error('RPC get_friends_with_profiles error:', error);
        // Fallback
        await loadFriendsFallback();
        return;
      }

      const friends: Friend[] = (data || []).map((f: any) => ({
        friend_id: f.friend_id,
        full_name: f.full_name || 'Inconnu',
        avatar_url: f.avatar_url || '',
        city: f.city || '',
        created_at: f.created_at,
      }));

      setCache(prev => ({ ...prev, friends }));
    } catch (error) {
      console.error('Error loading friends:', error);
      await loadFriendsFallback();
    }
  }, [user, loadFriendsFallback]);

  // ============================================
  // CHARGEMENT DES UTILISATEURS BLOQUÉS
  // ============================================

  const loadBlockedUsers = useCallback(async () => {
    try {
      const users = await blockService.getBlockedUsers();
      setBlockedUserIds(new Set(users.map(u => u.blockedUserId)));
    } catch (error) {
      console.error('Error loading blocked users:', error);
    }
  }, []);

  // ============================================
  // CHARGEMENT GLOBAL (OPTIMISÉ)
  // Maximum ~4-5 requêtes au lieu de 10+
  // ============================================

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Charger toutes les données en parallèle
      await Promise.all([
        loadActivities(),
        loadMyActivities(),
        loadConversations(),
        loadFriends(),
      ]);
      loadBlockedUsers();
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Error loading all data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadActivities, loadMyActivities, loadConversations, loadFriends, loadBlockedUsers]);

  // ============================================
  // MÉTHODES DE RAFRAÎCHISSEMENT
  // ============================================

  const refreshActivities = useCallback(async () => {
    await loadActivities();
    setLastUpdate(Date.now());
  }, [loadActivities]);

  const refreshMyActivities = useCallback(async () => {
    await loadMyActivities();
    setLastUpdate(Date.now());
  }, [loadMyActivities]);

  const refreshConversations = useCallback(async () => {
    await loadConversations();
    setLastUpdate(Date.now());
  }, [loadConversations]);

  const refreshFriends = useCallback(async () => {
    await loadFriends();
    setLastUpdate(Date.now());
  }, [loadFriends]);

  // ============================================
  // MÉTHODES DE MISE À JOUR LOCALE (optimistic)
  // ============================================

  const updateActivityInCache = useCallback((activityId: string, updates: Partial<Activity>) => {
    setCache(prev => ({
      ...prev,
      activities: prev.activities.map(a => a.id === activityId ? { ...a, ...updates } : a),
      myActivities: prev.myActivities.map(a => a.id === activityId ? { ...a, ...updates } : a),
    }));
  }, []);

  const addConversationToCache = useCallback((conversation: Conversation) => {
    setCache(prev => ({
      ...prev,
      conversations: [conversation, ...prev.conversations],
    }));
  }, []);

  const updateConversationInCache = useCallback((conversationId: string, updates: Partial<Conversation>) => {
    setCache(prev => ({
      ...prev,
      conversations: prev.conversations.map(c => c.id === conversationId ? { ...c, ...updates } : c),
    }));
  }, []);

  const markConversationAsRead = useCallback((conversationId: string) => {
    setCache(prev => ({
      ...prev,
      conversations: prev.conversations.map(c =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));

    // Mettre à jour last_read_at dans la base de données
    if (user?.id) {
      supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .then(() => {})
        .catch(console.error);
    }
  }, [user]);

  const removeConversationFromCache = useCallback((conversationId: string) => {
    setCache(prev => ({
      ...prev,
      conversations: prev.conversations.filter(c => c.id !== conversationId),
    }));
  }, []);

  const toggleMuteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user?.id) return false;

    // Trouver l'état actuel
    const conversation = cache.conversations.find(c => c.id === conversationId);
    if (!conversation) return false;

    const newMutedState = !conversation.isMuted;

    // Optimistic update
    setCache(prev => ({
      ...prev,
      conversations: prev.conversations.map(c =>
        c.id === conversationId ? { ...c, isMuted: newMutedState } : c
      ),
    }));

    try {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ is_muted: newMutedState })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) {
        // Rollback on error
        setCache(prev => ({
          ...prev,
          conversations: prev.conversations.map(c =>
            c.id === conversationId ? { ...c, isMuted: !newMutedState } : c
          ),
        }));
        console.error('Error toggling mute:', error);
        return false;
      }

      return newMutedState;
    } catch (error) {
      // Rollback on error
      setCache(prev => ({
        ...prev,
        conversations: prev.conversations.map(c =>
          c.id === conversationId ? { ...c, isMuted: !newMutedState } : c
        ),
      }));
      console.error('Error toggling mute:', error);
      return false;
    }
  }, [user, cache.conversations]);

  // ============================================
  // CHARGEMENT INITIAL
  // ============================================

  useEffect(() => {
    if (user && isInitialLoad.current) {
      isInitialLoad.current = false;
      loadAllData();
    }
  }, [user, loadAllData]);

  // Reset on logout
  useEffect(() => {
    if (!user) {
      isInitialLoad.current = true;
      setCache({
        activities: [],
        myActivities: [],
        conversations: [],
        friends: [],
        slotDataByActivity: {},
      });
      setLoading(true);
    }
  }, [user]);

  // ============================================
  // SUBSCRIPTIONS REALTIME (optimisé)
  // ============================================

  useEffect(() => {
    if (!user?.id) return;

    // Écouter les nouveaux messages
    const messagesChannel = supabase
      .channel('cache_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg = payload.new;
          if (blockedUserIds.has(newMsg.sender_id)) return;
          setCache(prev => {
            const convIndex = prev.conversations.findIndex(c => c.id === newMsg.conversation_id);
            if (convIndex === -1) return prev;

            const conv = prev.conversations[convIndex];
            const isMyMessage = newMsg.sender_id === user.id;

            const updatedConv: Conversation = {
              ...conv,
              lastMessage: formatLastMessage(newMsg.content, newMsg.message_type),
              lastMessageTime: formatRelativeTime(newMsg.created_at),
              updated_at: newMsg.created_at,
              unreadCount: isMyMessage ? conv.unreadCount : (conv.unreadCount || 0) + 1,
            };

            // Déplacer la conversation en haut de la liste
            const newConversations = prev.conversations.filter(c => c.id !== newMsg.conversation_id);
            return {
              ...prev,
              conversations: [updatedConv, ...newConversations],
            };
          });
        }
      )
      .subscribe();

    // Écouter les changements de blocked_users
    const blockedChannel = supabase
      .channel('cache_blocked_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users' }, () => {
        loadBlockedUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(blockedChannel);
    };
  }, [user, blockedUserIds, loadBlockedUsers]);

  return (
    <DataCacheContext.Provider
      value={{
        cache,
        loading,
        lastUpdate,
        loadAllData,
        refreshActivities,
        refreshMyActivities,
        refreshConversations,
        refreshFriends,
        refreshBlockedUsers: loadBlockedUsers,
        updateActivityInCache,
        addConversationToCache,
        updateConversationInCache,
        markConversationAsRead,
        removeConversationFromCache,
        toggleMuteConversation,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
}
