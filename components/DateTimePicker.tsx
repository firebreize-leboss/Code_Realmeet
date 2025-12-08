// components/DateTimePicker.tsx
// Composant de sélection de date et heure avec calendrier natif

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import DateTimePickerNative from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface DateTimePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode: 'date' | 'time';
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function DateTimePicker({
  label,
  value,
  onChange,
  mode,
  placeholder,
  minimumDate,
  maximumDate,
}: DateTimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value || new Date());

  const formatDisplayValue = (): string => {
    if (!value) {
      return placeholder || (mode === 'date' ? 'Sélectionner une date' : 'Sélectionner une heure');
    }

    if (mode === 'date') {
      return value.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } else {
      return value.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        onChange(selectedDate);
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const handleCancel = () => {
    setTempDate(value || new Date());
    setShowPicker(false);
  };

  const getIcon = (): "calendar" | "clock" => {
    return mode === 'date' ? 'calendar' : 'clock';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={styles.inputButton}
        onPress={() => {
          setTempDate(value || new Date());
          setShowPicker(true);
        }}
        activeOpacity={0.7}
      >
        <IconSymbol name={getIcon()} size={20} color={colors.primary} />
        <Text style={[styles.inputText, !value && styles.placeholderText]}>
          {formatDisplayValue()}
        </Text>
        <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={handleCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.cancelButton}>Annuler</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {mode === 'date' ? 'Choisir une date' : 'Choisir une heure'}
                </Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.confirmButton}>OK</Text>
                </TouchableOpacity>
              </View>

              <DateTimePickerNative
                value={tempDate}
                mode={mode}
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                locale="fr-FR"
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showPicker && (
          <DateTimePickerNative
            value={tempDate}
            mode={mode}
            display="default"
            onChange={handleChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
          />
        )
      )}
    </View>
  );
}

// Composant combiné pour date + heure de début + heure de fin
interface DateTimeRangePickerProps {
  dateLabel?: string;
  timeStartLabel?: string;
  timeEndLabel?: string;
  date: Date | null;
  timeStart: Date | null;
  timeEnd: Date | null;
  onDateChange: (date: Date) => void;
  onTimeStartChange: (time: Date) => void;
  onTimeEndChange: (time: Date) => void;
  showTimeEnd?: boolean;
}

export function DateTimeRangePicker({
  dateLabel = "Date de l'activité *",
  timeStartLabel = 'Heure de début *',
  timeEndLabel = 'Heure de fin (optionnel)',
  date,
  timeStart,
  timeEnd,
  onDateChange,
  onTimeStartChange,
  onTimeEndChange,
  showTimeEnd = true,
}: DateTimeRangePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <View style={styles.rangeContainer}>
      <DateTimePicker
        label={dateLabel}
        value={date}
        onChange={onDateChange}
        mode="date"
        minimumDate={today}
        placeholder="Sélectionner la date"
      />

      <View style={styles.timeRow}>
        <View style={styles.timeColumn}>
          <DateTimePicker
            label={timeStartLabel}
            value={timeStart}
            onChange={onTimeStartChange}
            mode="time"
            placeholder="Début"
          />
        </View>

        {showTimeEnd && (
          <View style={styles.timeColumn}>
            <DateTimePicker
              label={timeEndLabel}
              value={timeEnd}
              onChange={onTimeEndChange}
              mode="time"
              placeholder="Fin"
            />
          </View>
        )}
      </View>

      {date && timeStart && (
        <View style={styles.summaryContainer}>
          <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} />
          <Text style={styles.summaryText}>
            {date.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
            {' à '}
            {timeStart.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {timeEnd &&
              ` - ${timeEnd.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    textTransform: 'capitalize',
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  cancelButton: {
    fontSize: 17,
    color: colors.textSecondary,
  },
  confirmButton: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
  },
  picker: {
    height: 200,
  },
  rangeContainer: {
    gap: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeColumn: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});