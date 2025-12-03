// components/ActivityCalendar.tsx
// Calendrier hebdomadaire pour les créneaux d'activité

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
}

interface ActivityCalendarProps {
  activityId: string;
  onSlotSelect?: (slot: SelectedSlot | null) => void;
}

export default function ActivityCalendar({ activityId, onSlotSelect }: ActivityCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDays, setWeekDays] = useState<DaySlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newTime, setNewTime] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [shouldLoadSlots, setShouldLoadSlots] = useState(false);

  // Noms des jours en français
  const dayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    generateWeekDays();
    setShouldLoadSlots(true);
  }, [weekOffset]);

  useEffect(() => {
    if (shouldLoadSlots && weekDays.length > 0) {
      loadSlots();
      setShouldLoadSlots(false);
    }
  }, [shouldLoadSlots, activityId]);

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
        .select('id, date, time, created_by')
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

  const handleAddSlot = (date: Date) => {
    setSelectedDate(date);
    setNewTime('');
    setShowTimeModal(true);
  };

  const handleConfirmAddSlot = async () => {
    if (!selectedDate || !newTime || !currentUserId) return;

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

    try {
      setAddingSlot(true);

      const { error } = await supabase
        .from('activity_slots')
        .insert({
          activity_id: activityId,
          date: dateStr,
          time: formattedTime,
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
    if (selectedSlot?.id === slot.id) {
      setSelectedSlot(null);
      onSlotSelect?.(null);
    } else {
      const newSelection = {
        id: slot.id,
        date: slot.date,
        time: slot.time,
      };
      setSelectedSlot(newSelection);
      onSlotSelect?.(newSelection);
    }
  };

  const handleDeleteSlot = async (slotId: string, createdBy: string) => {
    if (createdBy !== currentUserId) {
      Alert.alert('Non autorisé', 'Vous ne pouvez supprimer que vos propres créneaux.');
      return;
    }

    Alert.alert(
      'Supprimer le créneau',
      'Êtes-vous sûr de vouloir supprimer ce créneau ?',
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
                .eq('id', slotId);
              
              if (selectedSlot?.id === slotId) {
                setSelectedSlot(null);
                onSlotSelect?.(null);
              }
              setShouldLoadSlots(true);
            } catch (error) {
              console.error('Erreur suppression:', error);
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
    } else {
      return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
    }
  };

  const maxSlots = Math.max(...weekDays.map(d => d.slots.length), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choix d'une date</Text>
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
          <View style={styles.calendarGrid}>
            <View style={styles.headerRow}>
              {weekDays.map((day, index) => (
                <View key={index} style={styles.dayHeader}>
                  <Text style={styles.dayName}>{day.dayName}</Text>
                  <Text style={styles.dayDate}>{day.dayNumber}-{day.monthShort}</Text>
                </View>
              ))}
            </View>

            <View style={styles.slotsGrid}>
              {weekDays.map((day, dayIndex) => (
                <View key={dayIndex} style={styles.dayColumn}>
                  {day.slots.map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    return (
                      <TouchableOpacity
                        key={slot.id}
                        style={[
                          styles.slotCell,
                          isSelected && styles.slotCellSelected,
                        ]}
                        onPress={() => handleSlotSelect(slot)}
                        onLongPress={() => handleDeleteSlot(slot.id, slot.createdBy)}
                        delayLongPress={500}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.slotTime,
                          isSelected && styles.slotTimeSelected,
                        ]}>
                          {slot.time.replace(':', 'h')}
                        </Text>
                        {isSelected && (
                          <IconSymbol name="checkmark" size={12} color={colors.background} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  
                  {Array.from({ length: Math.max(0, maxSlots - day.slots.length) }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.emptyCell} />
                  ))}
                  
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddSlot(day.date)}
                  >
                    <IconSymbol name="plus" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter un créneau</Text>
            <Text style={styles.modalSubtitle}>
              {selectedDate?.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </Text>
            
            <TextInput
              style={styles.timeInput}
              placeholder="Ex: 14h30 ou 14:30"
              placeholderTextColor={colors.textSecondary}
              value={newTime}
              onChangeText={setNewTime}
              keyboardType="default"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowTimeModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={handleConfirmAddSlot}
                disabled={addingSlot}
              >
                {addingSlot ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Ajouter</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  calendarGrid: {
    minWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  dayHeader: {
    width: 75,
    alignItems: 'center',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dayDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  slotsGrid: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  dayColumn: {
    width: 75,
    alignItems: 'center',
  },
  slotCell: {
    width: 65,
    height: 40,
    backgroundColor: '#87CEEB',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    flexDirection: 'row',
    gap: 2,
  },
  slotCellSelected: {
    backgroundColor: colors.primary,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  slotTimeSelected: {
    color: colors.background,
  },
  emptyCell: {
    width: 65,
    height: 40,
    backgroundColor: '#87CEEB20',
    borderRadius: 6,
    marginVertical: 4,
  },
  addButton: {
    width: 65,
    height: 40,
    backgroundColor: '#87CEEB40',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#87CEEB',
    borderStyle: 'dashed',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  timeInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});