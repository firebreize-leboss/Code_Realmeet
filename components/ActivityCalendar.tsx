// components/ActivityCalendar.tsx
// Calendrier des créneaux d'activité
// - mode="select" : pour les utilisateurs (affiche uniquement les jours qui ont des créneaux, paginé par 7 jours)
// - mode="edit"   : pour les entreprises (affiche la semaine courante avec navigation semaine par semaine)

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

interface TimeSlot {
  id: string;
  time: string; // "HH:MM"
  duration: number; // minutes
  createdBy: string;
  date: string; // "YYYY-MM-DD"
  participantCount?: number;
}

interface DaySlots {
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  dayName: string; // "LUN"
  dayNumber: string; // "01"
  monthShort: string; // "jan"
  slots: TimeSlot[];
}

interface SelectedSlot {
  id: string;
  date: string;
  time: string;
  duration?: number;
}

interface PendingSlot {
  date: string;
  time: string;
  duration: number;
}

interface ActivityCalendarProps {
  activityId?: string;
  onSlotSelect?: (slot: SelectedSlot | null) => void;
  externalSelectedSlot?: SelectedSlot | null;
  mode?: 'select' | 'edit';
  onSlotsChange?: (slots: PendingSlot[]) => void;
  pendingSlots?: PendingSlot[];
  readOnly?: boolean;
  userJoinedSlotId?: string;
}

const dayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

// Helper pour formater une date en YYYY-MM-DD sans décalage UTC
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ActivityCalendar({
  activityId,
  onSlotSelect,
  externalSelectedSlot,
  mode = 'select',
  onSlotsChange,
  pendingSlots = [],
  readOnly = false,
  userJoinedSlotId,
}: ActivityCalendarProps) {
  // Entreprise (edit) : navigation semaine -> weekOffset
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDays, setWeekDays] = useState<DaySlots[]>([]);

  // Utilisateur (select) : jours futurs avec créneaux -> pagination par pages de 7
  const [userDays, setUserDays] = useState<DaySlots[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  // UI / ajout créneau
  const [loading, setLoading] = useState(true);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState('60');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  const durationOptions = [
    { label: '30 min', value: 30 },
    { label: '1h', value: 60 },
    { label: '1h30', value: 90 },
    { label: '2h', value: 120 },
    { label: '2h30', value: 150 },
    { label: '3h', value: 180 },
    { label: '4h', value: 240 },
  ];

  // ---------- Helpers ----------
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  };

  const getMonday = (base: Date, offsetWeeks: number) => {
    const today = new Date(base);
    const currentDay = today.getDay(); // 0=dim
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() + mondayOffset + offsetWeeks * 7);
    return monday;
  };

  const buildWeekDays = (offsetWeeks: number): DaySlots[] => {
    const monday = getMonday(new Date(), offsetWeeks);
    const days: DaySlots[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = formatDateLocal(date);

      days.push({
        date,
        dateStr,
        dayName: dayNames[i],
        dayNumber: date.getDate().toString().padStart(2, '0'),
        monthShort: monthNames[date.getMonth()],
        slots: [],
      });
    }
    return days;
  };

  const buildDaySlotsFromDateStr = (dateStr: string, slots: TimeSlot[]): DaySlots => {
    const d = new Date(`${dateStr}T00:00:00`);
    const jsDay = d.getDay(); // 0..6
    const idx = jsDay === 0 ? 6 : jsDay - 1;

    return {
      date: d,
      dateStr,
      dayName: dayNames[idx],
      dayNumber: d.getDate().toString().padStart(2, '0'),
      monthShort: monthNames[d.getMonth()],
      slots,
    };
  };

  // ---------- Data loads ----------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data?.user?.id || null);
    })();
  }, []);

  // Sync external selected slot
  useEffect(() => {
    if (externalSelectedSlot === null) {
      setSelectedSlot(null);
    } else if (externalSelectedSlot && externalSelectedSlot.id !== selectedSlot?.id) {
      setSelectedSlot(externalSelectedSlot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedSlot]);

  // Edit mode -> regenerate week days when weekOffset changes
  useEffect(() => {
    if (mode !== 'edit') return;
    setWeekDays(buildWeekDays(weekOffset));
  }, [mode, weekOffset]);

  // Load slots
  useEffect(() => {
    // Mode création (pas d'activityId)
    if (!activityId) {
      if (mode === 'edit') {
        const days = buildWeekDays(weekOffset).map(day => {
          const daySlots = pendingSlots
            .filter(s => s.date === day.dateStr)
            .map((s, idx) => ({
              id: `pending-${day.dateStr}-${idx}`,
              time: s.time,
              duration: s.duration,
              createdBy: currentUserId || '',
              date: s.date,
            }));
          return { ...day, slots: daySlots };
        });
        setWeekDays(days);
      } else {
        const grouped = new Map<string, TimeSlot[]>();
        pendingSlots.forEach((s, idx) => {
          const list = grouped.get(s.date) || [];
          list.push({
            id: `pending-${s.date}-${idx}`,
            time: s.time,
            duration: s.duration,
            createdBy: currentUserId || '',
            date: s.date,
          });
          grouped.set(s.date, list);
        });

        const days = Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dateStr, slots]) =>
            buildDaySlotsFromDateStr(
              dateStr,
              slots.sort((a, b) => a.time.localeCompare(b.time))
            )
          );

        setUserDays(days);
        setPageIndex(0);
      }

      setLoading(false);
      return;
    }

    // Avec activityId -> charge depuis supabase
    const load = async () => {
      try {
        setLoading(true);
        const todayStr = formatDateLocal(new Date());

        if (mode === 'edit') {
          const days = buildWeekDays(weekOffset);
          setWeekDays(days);

          const startStr = days[0].dateStr;
          const endStr = days[6].dateStr;

          const { data, error } = await supabase
            .from('activity_slots')
            .select('id, date, time, duration, created_by')
            .eq('activity_id', activityId)
            .gte('date', todayStr)
            .gte('date', startStr)
            .lte('date', endStr)
            .order('time', { ascending: true });

          if (error) throw error;

          const slotIds = (data || []).map(s => s.id);

          let countBySlotId: Record<string, number> = {};
          if (slotIds.length > 0) {
            const { data: participants, error: pErr } = await supabase
              .from('slot_participants')
              .select('slot_id')
              .in('slot_id', slotIds);

            if (!pErr && participants) {
              countBySlotId = participants.reduce((acc: Record<string, number>, row: any) => {
                acc[row.slot_id] = (acc[row.slot_id] || 0) + 1;
                return acc;
              }, {});
            }
          }

          const updated = days.map(day => {
            const daySlotsRaw = (data?.filter(s => s.date === day.dateStr) || []);
            const daySlots: TimeSlot[] = daySlotsRaw.map(slot => ({
              id: slot.id,
              time: slot.time.slice(0, 5),
              duration: slot.duration || 60,
              createdBy: slot.created_by,
              date: slot.date,
              participantCount: countBySlotId[slot.id] || 0,
            }));
            return { ...day, slots: daySlots };
          });

          setWeekDays(updated);
        } else {
          const { data, error } = await supabase
            .from('activity_slots')
            .select('id, date, time, duration, created_by')
            .eq('activity_id', activityId)
            .gte('date', todayStr)
            .order('date', { ascending: true })
            .order('time', { ascending: true });

          if (error) throw error;

          const grouped = new Map<string, any[]>();
          (data || []).forEach(s => {
            const list = grouped.get(s.date) || [];
            list.push(s);
            grouped.set(s.date, list);
          });

          const days: DaySlots[] = await Promise.all(
            Array.from(grouped.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(async ([dateStr, slotsRaw]) => {
                const slots: TimeSlot[] = await Promise.all(
                  slotsRaw.map(async slot => {
                    const { count } = await supabase
                      .from('slot_participants')
                      .select('*', { count: 'exact', head: true })
                      .eq('slot_id', slot.id);

                    return {
                      id: slot.id,
                      time: slot.time.slice(0, 5),
                      duration: slot.duration || 60,
                      createdBy: slot.created_by,
                      date: slot.date,
                      participantCount: count || 0,
                    };
                  })
                );

                return buildDaySlotsFromDateStr(dateStr, slots);
              })
          );

          setUserDays(days);
          setPageIndex(0);
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ x: 0, animated: false });
          });
        }
      } catch (e) {
        console.error('Erreur chargement créneaux:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activityId, mode, weekOffset, currentUserId]);

  // ---------- Pagination (select mode) ----------
  const visibleDays: DaySlots[] = useMemo(() => {
    return mode === 'edit' ? weekDays : userDays;
  }, [mode, weekDays, userDays]);

  const dayPages: DaySlots[][] = useMemo(() => {
    if (mode === 'edit') return [weekDays];

    const pages: DaySlots[][] = [];
    for (let i = 0; i < userDays.length; i += 7) {
      pages.push(userDays.slice(i, i + 7));
    }
    return pages.length ? pages : [[]];
  }, [mode, weekDays, userDays]);

  const canScrollDays = mode !== 'edit' && dayPages.length > 1;

  const currentPage = useMemo(() => {
    if (mode === 'edit') return dayPages[0] || [];
    return dayPages[Math.min(pageIndex, dayPages.length - 1)] || [];
  }, [mode, dayPages, pageIndex]);

  const onHorizontalScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!canScrollDays) return;
    const x = e.nativeEvent.contentOffset.x;
    const w = e.nativeEvent.layoutMeasurement.width || 1;
    const idx = Math.round(x / w);
    if (idx !== pageIndex) setPageIndex(idx);
  };

  // ---------- Header title ----------
  const getWeekTitle = () => {
    if (mode === 'edit') {
      if (weekDays.length === 0) return '';
      const start = weekDays[0].date;
      const end = weekDays[6].date;
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
      }
      return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
    }

    const page = currentPage;
    if (!page || page.length === 0) return '';
    const start = page[0].date;
    const end = page[page.length - 1].date;

    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
  };

  // ---------- Actions ----------
  const navigate = (direction: number) => {
    if (mode === 'edit') {
      setWeekOffset(prev => prev + direction);
      return;
    }

    const next = pageIndex + direction;
    if (next < 0 || next > dayPages.length - 1) return;

    setPageIndex(next);
    requestAnimationFrame(() => {
      // sera recalé via scrollWidth ensuite
      scrollRef.current?.scrollTo({ x: next * 99999, animated: true });
    });
  };

  // hack: scrollTo avec vraie largeur
  const [scrollWidth, setScrollWidth] = useState(0);
  useEffect(() => {
    if (!canScrollDays) return;
    if (scrollWidth <= 0) return;
    scrollRef.current?.scrollTo({ x: pageIndex * scrollWidth, animated: true });
  }, [pageIndex, scrollWidth, canScrollDays]);

  const handleAddSlot = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      Alert.alert('Date invalide', 'Impossible de créer un créneau dans le passé.');
      return;
    }
    setSelectedDate(date);
    setNewTime('');
    setNewDuration('60');
    setShowTimeModal(true);
  };

  const handleConfirmAddSlot = async () => {
    if (!selectedDate || !newTime) return;

    const timeRegex = /^(\d{1,2})[hH:]?(\d{2})$/;
    const match = newTime.match(timeRegex);
    if (!match) {
      Alert.alert('Format invalide', "Entrez l'heure au format HH:MM ou HHhMM (ex: 14:30 ou 14h30)");
      return;
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      Alert.alert('Heure invalide', "L'heure doit être entre 00:00 et 23:59");
      return;
    }

    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const dateStr = formatDateLocal(selectedDate);
    const duration = parseInt(newDuration, 10);

    // Création sans activityId -> pendingSlots
    if (!activityId) {
      const exists = pendingSlots.some(s => s.date === dateStr && s.time === formattedTime);
      if (exists) {
        Alert.alert('Créneau existant', 'Ce créneau existe déjà.');
        return;
      }
      onSlotsChange?.([...pendingSlots, { date: dateStr, time: formattedTime, duration }]);
      setShowTimeModal(false);
      return;
    }

    // Edition avec activityId -> INSERT + MAJ immédiate de l'UI (pas de loading infini)
    try {
      setAddingSlot(true);

      const { data: inserted, error } = await supabase
        .from('activity_slots')
        .insert({
          activity_id: activityId,
          date: dateStr,
          time: formattedTime,
          duration,
          created_by: currentUserId,
        })
        .select('id')
        .single();

      if (error) {
        if ((error as any).code === '23505') {
          Alert.alert('Créneau existant', 'Ce créneau existe déjà pour cette date.');
          return;
        }
        throw error;
      }

      const newSlot: TimeSlot = {
        id: inserted?.id || `tmp-${dateStr}-${formattedTime}`,
        time: formattedTime,
        duration,
        createdBy: currentUserId || '',
        date: dateStr,
        participantCount: 0,
      };

      // ✅ MAJ immédiate pour la semaine affichée
      setWeekDays(prev =>
        prev.map(day => {
          if (day.dateStr !== dateStr) return day;
          const merged = [...day.slots, newSlot].sort((a, b) => a.time.localeCompare(b.time));
          return { ...day, slots: merged };
        })
      );

      setShowTimeModal(false);
    } catch (e) {
      console.error('Erreur ajout créneau:', e);
      Alert.alert('Erreur', "Impossible d'ajouter le créneau.");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (mode === 'edit' || readOnly) return;

    if (selectedSlot?.id === slot.id) {
      setSelectedSlot(null);
      onSlotSelect?.(null);
    } else {
      const newSelection: SelectedSlot = {
        id: slot.id,
        date: slot.date,
        time: slot.time,
        duration: slot.duration,
      };
      setSelectedSlot(newSelection);
      onSlotSelect?.(newSelection);
    }
  };

  const handleDeleteSlot = async (slot: TimeSlot) => {
    if (mode !== 'edit') return;

    if (!activityId) {
      const filtered = pendingSlots.filter(s => !(s.date === slot.date && s.time === slot.time));
      onSlotsChange?.(filtered);
      return;
    }

    Alert.alert('Supprimer le créneau', `Supprimer le créneau de ${slot.time} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('activity_slots').delete().eq('id', slot.id);

            if (selectedSlot?.id === slot.id) {
              setSelectedSlot(null);
              onSlotSelect?.(null);
            }

            // ✅ MAJ UI immédiate
            setWeekDays(prev =>
              prev.map(day => {
                if (day.dateStr !== slot.date) return day;
                return { ...day, slots: day.slots.filter(s => s.id !== slot.id) };
              })
            );
          } catch (e) {
            console.error('Erreur suppression:', e);
            Alert.alert('Erreur', 'Impossible de supprimer le créneau.');
          }
        },
      },
    ]);
  };

  // ---------- Render helpers ----------
  const renderDayColumn = (day: DaySlots, key: string) => (
    <View key={key} style={styles.dayColumn}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayName}>{day.dayName}</Text>
        <Text style={styles.dayNumber}>{day.dayNumber}</Text>
        <Text style={styles.monthShort}>{day.monthShort}</Text>
      </View>

      <View style={styles.slotsContainer}>
        {day.slots.map(slot => {
          const isUserJoined = userJoinedSlotId === slot.id;
          const isSelected = selectedSlot?.id === slot.id;

          return (
            <TouchableOpacity
              key={slot.id}
              style={[
                styles.slotBadge,
                isSelected && styles.slotBadgeSelected,
                isUserJoined && styles.slotBadgeJoined,
                mode === 'edit' && styles.slotBadgeEdit,
                readOnly && styles.slotBadgeReadOnly,
              ]}
              onPress={() => handleSlotSelect(slot)}
              onLongPress={() => mode === 'edit' && handleDeleteSlot(slot)}
              delayLongPress={500}
              disabled={readOnly && !isUserJoined}
            >
              {isUserJoined && (
                <View style={styles.joinedIndicator}>
                  <IconSymbol name="checkmark.circle.fill" size={12} color="#10b981" />
                </View>
              )}

              <Text
                style={[
                  styles.slotTime,
                  isSelected && styles.slotTimeSelected,
                  isUserJoined && styles.slotTimeJoined,
                ]}
              >
                {slot.time}
              </Text>

              <Text
                style={[
                  styles.slotDuration,
                  isSelected && styles.slotDurationSelected,
                  isUserJoined && styles.slotDurationJoined,
                ]}
              >
                {formatDuration(slot.duration)}
              </Text>

              {slot.participantCount !== undefined && slot.participantCount > 0 && (
                <View style={styles.slotParticipantBadge}>
                  <IconSymbol name="person.fill" size={10} color={colors.background} />
                  <Text style={styles.slotParticipantText}>{slot.participantCount}</Text>
                </View>
              )}

              {mode === 'edit' && (
                <TouchableOpacity
                  style={styles.deleteSlotButton}
                  onPress={() => handleDeleteSlot(slot)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol name="xmark.circle.fill" size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        {mode === 'edit' && (
          <TouchableOpacity style={styles.addSlotButton} onPress={() => handleAddSlot(day.date)}>
            <IconSymbol name="plus" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ---------- UI ----------
  const headerTitle =
    mode === 'edit'
      ? 'Gérer les créneaux'
      : readOnly
        ? 'Créneaux disponibles'
        : "Choix d'une date";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{headerTitle}</Text>

        {userJoinedSlotId && (
          <View style={styles.joinedLegend}>
            <View style={styles.joinedLegendDot} />
            <Text style={styles.joinedLegendText}>Votre créneau</Text>
          </View>
        )}

        <View style={styles.weekNav}>
          <TouchableOpacity
            onPress={() => navigate(-1)}
            style={styles.navButton}
            disabled={mode !== 'edit' && pageIndex === 0}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.weekTitle}>{getWeekTitle()}</Text>

          <TouchableOpacity
            onPress={() => navigate(1)}
            style={styles.navButton}
            disabled={mode !== 'edit' && pageIndex >= dayPages.length - 1}
          >
            <IconSymbol name="chevron.right" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : visibleDays.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Aucun créneau disponible.</Text>
        </View>
      ) : mode === 'edit' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weekContainer}>
            <View style={styles.daysRow}>{weekDays.map((day, i) => renderDayColumn(day, `edit-${i}`))}</View>
          </View>
        </ScrollView>
      ) : canScrollDays ? (
        <ScrollView
          ref={r => {
            scrollRef.current = r;
          }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onLayout={e => setScrollWidth(e.nativeEvent.layout.width)}
          onMomentumScrollEnd={onHorizontalScrollEnd}
        >
          {dayPages.map((page, pIdx) => (
            <View key={`page-${pIdx}`} style={styles.weekPage}>
              <View style={styles.weekContainer}>
                <View style={styles.daysRow}>{page.map((day, i) => renderDayColumn(day, `p${pIdx}-${i}`))}</View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.weekPageNoScroll}>
          <View style={styles.weekContainer}>
            <View style={styles.daysRow}>{dayPages[0].map((day, i) => renderDayColumn(day, `nos-${i}`))}</View>
          </View>
        </View>
      )}

      {/* Modal ajout de créneau (edit) */}
      <Modal
        visible={showTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un créneau</Text>
              <TouchableOpacity onPress={() => setShowTimeModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedDate && (
              <Text style={styles.modalDate}>
                {selectedDate.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Heure de début</Text>
              <TextInput
                style={styles.timeInput}
                placeholder="14:30 ou 14h30"
                placeholderTextColor={colors.textSecondary}
                value={newTime}
                onChangeText={setNewTime}
                keyboardType="numbers-and-punctuation"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Durée</Text>
              <View style={styles.durationGrid}>
                {durationOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.durationOption,
                      parseInt(newDuration, 10) === option.value && styles.durationOptionSelected,
                    ]}
                    onPress={() => setNewDuration(option.value.toString())}
                  >
                    <Text
                      style={[
                        styles.durationOptionText,
                        parseInt(newDuration, 10) === option.value && styles.durationOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, addingSlot && styles.confirmButtonDisabled]}
              onPress={handleConfirmAddSlot}
              disabled={addingSlot}
            >
              {addingSlot ? <ActivityIndicator color={colors.background} /> : <Text style={styles.confirmButtonText}>Ajouter le créneau</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  joinedLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  joinedLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  joinedLegendText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: 8,
  },
  weekTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },

  weekContainer: {
    minWidth: '100%',
  },
  daysRow: {
    flexDirection: 'row',
  },
  dayColumn: {
    width: 80,
    marginRight: 8,
  },
  dayHeader: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: 10,
    marginBottom: 8,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginVertical: 2,
  },
  monthShort: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  slotsContainer: {
    gap: 6,
  },
  slotBadge: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  slotBadgeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotBadgeJoined: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  slotBadgeEdit: {
    position: 'relative',
  },
  slotBadgeReadOnly: {
    opacity: 0.7,
  },
  joinedIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  slotTimeSelected: {
    color: colors.background,
  },
  slotTimeJoined: {
    color: colors.background,
  },
  slotDuration: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  slotDurationSelected: {
    color: colors.background,
    opacity: 0.8,
  },
  slotDurationJoined: {
    color: colors.background,
    opacity: 0.8,
  },

  deleteSlotButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  addSlotButton: {
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
  },

  weekPage: {
    width: '100%',
    flexDirection: 'row',
  },
  weekPageNoScroll: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },

  slotParticipantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  slotParticipantText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalDate: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  timeInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  durationOptionTextSelected: {
    color: colors.background,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
});
