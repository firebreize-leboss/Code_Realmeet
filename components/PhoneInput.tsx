// components/PhoneInput.tsx
// Input téléphone avec sélecteur d'indicatif pays

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, typography, borderRadius } from '@/styles/commonStyles';

interface CountryCode {
  code: string;
  dial: string;
  flag: string;
  name: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'BE', dial: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', dial: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: 'LU', dial: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'MA', dial: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: 'TN', dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: 'DZ', dial: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: 'SN', dial: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'CI', dial: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
  { code: 'CM', dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'MC', dial: '+377', flag: '🇲🇨', name: 'Monaco' },
  { code: 'RE', dial: '+262', flag: '🇷🇪', name: 'La Réunion' },
  { code: 'GP', dial: '+590', flag: '🇬🇵', name: 'Guadeloupe' },
  { code: 'MQ', dial: '+596', flag: '🇲🇶', name: 'Martinique' },
  { code: 'GF', dial: '+594', flag: '🇬🇫', name: 'Guyane française' },
];

// Longueur attendue du numéro local (sans indicatif) par indicatif
const PHONE_LENGTH_BY_DIAL: Record<string, { min: number; max: number }> = {
  '+33': { min: 9, max: 9 },    // France: 6 12 34 56 78 (9 chiffres)
  '+32': { min: 8, max: 9 },    // Belgique
  '+41': { min: 9, max: 9 },    // Suisse
  '+352': { min: 6, max: 9 },   // Luxembourg
  '+1': { min: 10, max: 10 },   // USA/Canada
  '+212': { min: 9, max: 9 },   // Maroc
  '+216': { min: 8, max: 8 },   // Tunisie
  '+213': { min: 9, max: 9 },   // Algérie
  '+221': { min: 9, max: 9 },   // Sénégal
  '+225': { min: 10, max: 10 }, // Côte d'Ivoire
  '+237': { min: 9, max: 9 },   // Cameroun
  '+49': { min: 10, max: 11 },  // Allemagne
  '+34': { min: 9, max: 9 },    // Espagne
  '+39': { min: 9, max: 10 },   // Italie
  '+351': { min: 9, max: 9 },   // Portugal
  '+44': { min: 10, max: 10 },  // UK
  '+377': { min: 8, max: 8 },   // Monaco
  '+262': { min: 9, max: 9 },   // Réunion
  '+590': { min: 9, max: 9 },   // Guadeloupe
  '+596': { min: 9, max: 9 },   // Martinique
  '+594': { min: 9, max: 9 },   // Guyane
};

export interface PhoneValue {
  countryCode: string; // e.g. "+33"
  localNumber: string; // e.g. "612345678"
}

/** Validate a phone number and return an error message or null */
export function validatePhone(phone: PhoneValue): string | null {
  if (!phone.localNumber || phone.localNumber.trim().length === 0) {
    return 'Le numéro de téléphone est requis';
  }

  const digits = phone.localNumber.replace(/[\s\-\.\(\)]/g, '');

  // Remove leading 0 for countries where it's common (France, etc.)
  const normalizedDigits = digits.startsWith('0') ? digits.slice(1) : digits;

  if (!/^\d+$/.test(normalizedDigits)) {
    return 'Le numéro ne doit contenir que des chiffres';
  }

  const lengthRule = PHONE_LENGTH_BY_DIAL[phone.countryCode];
  if (lengthRule) {
    if (normalizedDigits.length < lengthRule.min || normalizedDigits.length > lengthRule.max) {
      const expected = lengthRule.min === lengthRule.max
        ? `${lengthRule.min} chiffres`
        : `entre ${lengthRule.min} et ${lengthRule.max} chiffres`;
      return `Numéro invalide — ${expected} attendus (sans le 0)`;
    }
  } else {
    // Fallback: at least 6 digits
    if (normalizedDigits.length < 6) {
      return 'Numéro de téléphone trop court';
    }
  }

  return null;
}

/** Combine country code + local number into a full phone string */
export function formatFullPhone(phone: PhoneValue): string {
  if (!phone.localNumber) return '';
  const digits = phone.localNumber.replace(/[\s\-\.\(\)]/g, '');
  const normalized = digits.startsWith('0') ? digits.slice(1) : digits;
  return `${phone.countryCode}${normalized}`;
}

/** Parse a full phone string back into PhoneValue */
export function parsePhone(fullPhone: string): PhoneValue {
  if (!fullPhone) return { countryCode: '+33', localNumber: '' };
  // Try to match known country codes (longest first)
  const sorted = COUNTRY_CODES.slice().sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (fullPhone.startsWith(c.dial)) {
      return { countryCode: c.dial, localNumber: fullPhone.slice(c.dial.length) };
    }
  }
  return { countryCode: '+33', localNumber: fullPhone.replace(/^\+\d+/, '') };
}

interface PhoneInputProps {
  value: PhoneValue;
  onChangeValue: (value: PhoneValue) => void;
  error?: string;
  label?: string;
  required?: boolean;
}

export function PhoneInput({ value, onChangeValue, error, label, required }: PhoneInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCountry = COUNTRY_CODES.find(c => c.dial === value.countryCode) || COUNTRY_CODES[0];

  const filteredCountries = search.trim()
    ? COUNTRY_CODES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRY_CODES;

  const handleSelectCountry = useCallback((country: CountryCode) => {
    onChangeValue({ ...value, countryCode: country.dial });
    setShowPicker(false);
    setSearch('');
  }, [value, onChangeValue]);

  const handleNumberChange = useCallback((text: string) => {
    // Only allow digits, spaces, hyphens, dots, parentheses
    const cleaned = text.replace(/[^\d\s\-\.\(\)]/g, '');
    onChangeValue({ ...value, localNumber: cleaned });
  }, [value, onChangeValue]);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputRowFocused,
          error && styles.inputRowError,
        ]}
      >
        {/* Country code selector */}
        <TouchableOpacity
          style={styles.countrySelector}
          onPress={() => setShowPicker(true)}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={styles.dialCode}>{selectedCountry.dial}</Text>
          <IconSymbol name="chevron.down" size={12} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.separator} />

        {/* Phone number input */}
        <TextInput
          style={styles.input}
          placeholder="6 12 34 56 78"
          placeholderTextColor={colors.textMuted}
          value={value.localNumber}
          onChangeText={handleNumberChange}
          keyboardType="phone-pad"
          autoComplete="tel"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.helper}>Requis — pour les notifications importantes</Text>
      )}

      {/* Country picker modal */}
      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowPicker(false); setSearch(''); }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Indicatif pays</Text>
            <TouchableOpacity onPress={() => { setShowPicker(false); setSearch(''); }}>
              <IconSymbol name="xmark" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <IconSymbol name="magnifyingglass" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un pays..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countryRow,
                  item.dial === value.countryCode && styles.countryRowSelected,
                ]}
                onPress={() => handleSelectCountry(item)}
              >
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryDial}>{item.dial}</Text>
                {item.dial === value.countryCode && (
                  <IconSymbol name="checkmark" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.countryDivider} />}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semibold as any,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  required: {
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 52,
  },
  inputRowFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundAlt,
  },
  inputRowError: {
    borderColor: colors.error,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: 6,
    height: '100%',
  },
  flag: {
    fontSize: 20,
  },
  dialCode: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  separator: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderLight,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  helper: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  error: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.error,
    marginLeft: spacing.xs,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold as any,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  countryRowSelected: {
    backgroundColor: colors.primaryLight,
  },
  countryFlag: {
    fontSize: 22,
    width: 32,
  },
  countryName: {
    flex: 1,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  countryDial: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
  countryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginLeft: spacing.lg + 32 + spacing.md,
  },
});
