// components/ActivityCalendar.tsx
// Calendrier hebdomadaire pour les créneaux d'activité
// Mode "select" = lecture seule pour choisir un créneau
// Mode "edit" = permet d'ajouter/supprimer des créneaux (entreprises)

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

interface TimeSlot {
  id: string;
  time: string;
  duration: number; // durée en minutes
  createdBy: string;
  date: string;
}

interface DaySlots {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNumber: string;
  monthShort: string;
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDays, setWeekDays] = useState<DaySlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState('60');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [shouldLoadSlots, setShouldLoadSlots] = useState(false);

  const dayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

  const durationOptions = [
    { label: '30 min', value: 30 },
    { label: '1h', value: 60 },
    { label: '1h30', value: 90 },
    { label: '2h', value: 120 },
    { label: '2h30', value: 150 },
    { label: '3h', value: 180 },
    { label: '4h', value: 240 },
  ];

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    generateWeekDays();
    setShouldLoadSlots(true);
  }, [weekOffset]);

  useEffect(() => {
    if (shouldLoadSlots && weekDays.length > 0) {
      if (activityId) {
        loadSlots();
      } else {
        applyPendingSlots();
      }
      setShouldLoadSlots(false);
    }
  }, [shouldLoadSlots, activityId, pendingSlots]);

  useEffect(() => {
    if (externalSelectedSlot === null) {
      setSelectedSlot(null);
    } else if (externalSelectedSlot && externalSelectedSlot.id !== selectedSlot?.id) {
      setSelectedSlot(externalSelectedSlot);
    }
  }, [externalSelectedSlot]);

  const loadCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data?.user?.id || null);
  };

  const generateWeekDays = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));

    const days: DaySlots[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      
      days.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        dayName: dayNames[i],
        dayNumber: date.getDate().toString().padStart(2, '0'),
        monthShort: monthNames[date.getMonth()],
        slots: [],
      });
    }
    setWeekDays(days);
  };

  const applyPendingSlots = () => {
    const updatedDays = weekDays.map(day => {
      const dayStr = day.date.toISOString().split('T')[0];
      const daySlots = pendingSlots
        .filter(slot => slot.date === dayStr)
        .map((slot, idx) => ({
          id: `pending-${dayStr}-${idx}`,
          time: slot.time,
          duration: slot.duration,
          createdBy: currentUserId || '',
          date: slot.date,
        }));
      
      return { ...day, slots: daySlots };
    });

    setWeekDays(updatedDays);
    setLoading(false);
  };

  const loadSlots = async () => {
    try {
      setLoading(true);
      
      const startDate = weekDays[0]?.date;
      const endDate = weekDays[6]?.date;
      
      if (!startDate || !endDate) return;

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('activity_slots')
        .select('id, date, time, duration, created_by')
        .eq('activity_id', activityId)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('time', { ascending: true });

      if (error) throw error;

      const updatedDays = weekDays.map(day => {
        const dayStr = day.date.toISOString().split('T')[0];
        const daySlots = data?.filter(slot => slot.date === dayStr).map(slot => ({
          id: slot.id,
          time: slot.time.slice(0, 5),
          duration: slot.duration || 60,
          createdBy: slot.created_by,
          date: slot.date,
        })) || [];
        
        return { ...day, slots: daySlots };
      });

      setWeekDays(updatedDays);
    } catch (error) {
      console.error('Erreur chargement créneaux:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  };

  const handleAddSlot = (date: Date) => {
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
      Alert.alert('Format invalide', 'Entrez l\'heure au format HH:MM ou HHhMM (ex: 14:30 ou 14h30)');
      return;
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      Alert.alert('Heure invalide', 'L\'heure doit être entre 00:00 et 23:59');
      return;
    }

    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const dateStr = selectedDate.toISOString().split('T')[0];
    const duration = parseInt(newDuration, 10);

    // Mode création (pas d'activityId) - on stocke localement
    if (!activityId) {
      const newPendingSlot: PendingSlot = {
        date: dateStr,
        time: formattedTime,
        duration,
      };
      
      const exists = pendingSlots.some(
        s => s.date === dateStr && s.time === formattedTime
      );
      
      if (exists) {
        Alert.alert('Créneau existant', 'Ce créneau existe déjà.');
        return;
      }

      onSlotsChange?.([...pendingSlots, newPendingSlot]);
      setShowTimeModal(false);
      setShouldLoadSlots(true);
      return;
    }

    // Mode édition avec activityId - on sauvegarde en BDD
    try {
      setAddingSlot(true);

      const { error } = await supabase
        .from('activity_slots')
        .insert({
          activity_id: activityId,
          date: dateStr,
          time: formattedTime,
          duration,
          created_by: currentUserId,
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Créneau existant', 'Ce créneau existe déjà pour cette date.');
        } else {
          throw error;
        }
      } else {
        setShowTimeModal(false);
        setShouldLoadSlots(true);
      }
    } catch (error) {
      console.error('Erreur ajout créneau:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter le créneau.');
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
      const newSelection = {
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

    // Mode création sans activityId
    if (!activityId) {
      const filtered = pendingSlots.filter(
        s => !(s.date === slot.date && s.time === slot.time)
      );
      onSlotsChange?.(filtered);
      setShouldLoadSlots(true);
      return;
    }

    // Mode édition avec activityId - confirmation puis suppression BDD
    Alert.alert(
      'Supprimer le créneau',
      `Supprimer le créneau de ${slot.time} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('activity_slots')
                .delete()
                .eq('id', slot.id);
              
              if (selectedSlot?.id === slot.id) {
                setSelectedSlot(null);
                onSlotSelect?.(null);
              }
              setShouldLoadSlots(true);
            } catch (error) {
              console.error('Erreur suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le créneau.');
            }
          },
        },
      ]
    );
  };

  const navigateWeek = (direction: number) => {
    setWeekOffset(prev => prev + direction);
  };

  const getWeekTitle = () => {
    if (weekDays.length === 0) return '';
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
  };

  const maxSlots = Math.max(...weekDays.map(d => d.slots.length), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === 'edit' ? 'Gérer les créneaux' : readOnly ? 'Créneaux disponibles' : 'Choix d\'une date'}
        </Text>
        {userJoinedSlotId && (
          <View style={styles.joinedLegend}>
            <View style={styles.joinedLegendDot} />
            <Text style={styles.joinedLegendText}>Votre créneau</Text>
          </View>
        )}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => navigateWeek(-1)} style={styles.navButton}>
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.weekTitle}>{getWeekTitle()}</Text>
          <TouchableOpacity onPress={() => navigateWeek(1)} style={styles.navButton}>
            <IconSymbol name="chevron.right" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weekContainer}>
            <View style={styles.daysRow}>
              {weekDays.map((day, index) => (
                <View key={index} style={styles.dayColumn}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{day.dayName}</Text>
                    <Text style={styles.dayNumber}>{day.dayNumber}</Text>
                    <Text style={styles.monthShort}>{day.monthShort}</Text>
                  </View>
                  
                  <View style={styles.slotsContainer}>
                    {day.slots.map((slot) => {
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
                          <Text style={[
                            styles.slotTime,
                            isSelected && styles.slotTimeSelected,
                            isUserJoined && styles.slotTimeJoined,
                          ]}>
                            {slot.time}
                          </Text>
                          <Text style={[
                            styles.slotDuration,
                            isSelected && styles.slotDurationSelected,
                            isUserJoined && styles.slotDurationJoined,
                          ]}>
                            {formatDuration(slot.duration)}
                          </Text>
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
                      <TouchableOpacity
                        style={styles.addSlotButton}
                        onPress={() => handleAddSlot(day.date)}
                      >
                        <IconSymbol name="plus" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Modal ajout de créneau */}
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
                  month: 'long' 
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
                {durationOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.durationOption,
                      parseInt(newDuration) === option.value && styles.durationOptionSelected,
                    ]}
                    onPress={() => setNewDuration(option.value.toString())}
                  >
                    <Text style={[
                      styles.durationOptionText,
                      parseInt(newDuration) === option.value && styles.durationOptionTextSelected,
                    ]}>
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
              {addingSlot ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.confirmButtonText}>Ajouter le créneau</Text>
              )}
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