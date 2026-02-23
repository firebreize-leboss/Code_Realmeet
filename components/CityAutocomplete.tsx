// components/CityAutocomplete.tsx
// Composant d'autocomplétion de ville via Nominatim API

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface CityResult {
  placeId: string;
  displayName: string;
  city: string;
  country: string;
  postcode: string;
  latitude: number;
  longitude: number;
}

interface CityAutocompleteProps {
  value: string;
  onCitySelect: (result: {
    city: string;
    postcode: string;
    latitude: number;
    longitude: number;
    displayName: string;
  }) => void;
  onCityChange?: () => void;
  placeholder?: string;
  label?: string;
  inputStyle?: 'default' | 'premium';
  error?: string;
}

export function CityAutocomplete({
  value,
  onCitySelect,
  onCityChange,
  placeholder = 'Rechercher une ville...',
  label,
  inputStyle = 'default',
  error,
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [hasSelected, setHasSelected] = useState(!!value);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value && !hasSelected) {
      setQuery(value);
    }
  }, [value]);

  const searchCity = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        format: 'json',
        limit: '5',
        addressdetails: '1',
        featuretype: 'city',
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            'User-Agent': 'RealMeet-App/1.0',
            'Accept-Language': 'fr',
          },
        }
      );

      if (!response.ok) throw new Error('Erreur de recherche');

      const data = await response.json();

      const formattedResults: CityResult[] = data.map((item: any) => {
        const address = item.address || {};
        const cityName = address.city || address.town || address.village || address.municipality || '';

        return {
          placeId: item.place_id.toString(),
          displayName: item.display_name,
          city: cityName || item.display_name.split(',')[0] || '',
          country: address.country || '',
          postcode: address.postcode || '',
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        };
      });

      // Deduplicate by city name + country
      const uniqueCities = formattedResults.filter(
        (result, index, self) =>
          index === self.findIndex((r) => r.city === result.city && r.country === result.country)
      );

      setResults(uniqueCities);
      setShowResults(uniqueCities.length > 0);
    } catch (error) {
      console.error('Erreur autocomplétion ville:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (hasSelected) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchCity(query);
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, hasSelected]);

  const handleSelect = (result: CityResult) => {
    setHasSelected(true);
    setQuery(result.city);
    setShowResults(false);
    Keyboard.dismiss();

    onCitySelect({
      city: result.city,
      postcode: result.postcode,
      latitude: result.latitude,
      longitude: result.longitude,
      displayName: result.displayName,
    });
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (hasSelected) {
      setHasSelected(false);
      onCityChange?.();
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setHasSelected(false);
    onCityChange?.();
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.inputWrapper}>
        <View style={[
          styles.inputContainer,
          inputStyle === 'premium' && styles.inputContainerPremium,
        ]}>
          <IconSymbol name="location.fill" size={18} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleChangeText}
            onFocus={() => {
              if (results.length > 0 && !hasSelected) setShowResults(true);
            }}
          />
          {isSearching && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
          {query.length > 0 && !isSearching && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {showResults && results.length > 0 && (
          <View style={styles.resultsContainer}>
            <ScrollView
              style={styles.resultsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {results.map((item) => (
                <TouchableOpacity
                  key={item.placeId}
                  style={styles.resultItem}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultIcon}>
                    <IconSymbol name="location.fill" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultCity} numberOfLines={1}>
                      {item.city}
                    </Text>
                    <Text style={styles.resultPostcode} numberOfLines={1}>
                      {[item.postcode, item.country].filter(Boolean).join(' - ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {hasSelected && (
        <View style={styles.selectedIndicator}>
          <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} />
          <Text style={styles.selectedText}>Ville sélectionnée</Text>
        </View>
      )}

      {!hasSelected && error && query.length > 0 && (
        <View style={styles.errorIndicator}>
          <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  inputContainerPremium: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  clearButton: {
    padding: 4,
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTextContainer: {
    flex: 1,
  },
  resultCity: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  resultPostcode: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  selectedText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  errorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
    flex: 1,
  },
});
