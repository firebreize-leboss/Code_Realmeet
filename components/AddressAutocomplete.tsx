// components/AddressAutocomplete.tsx
// Composant d'autocomplétion d'adresse style Google Maps

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface AutocompleteResult {
  placeId: string;
  displayName: string;
  address: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
}

interface AddressAutocompleteProps {
  value: string;
  onAddressSelect: (result: {
    address: string;
    city: string;
    postcode: string;
    latitude: number;
    longitude: number;
    displayName: string;
  }) => void;
  placeholder?: string;
  label?: string;
}

export function AddressAutocomplete({
  value,
  onAddressSelect,
  placeholder = 'Rechercher une adresse...',
  label = 'Adresse *',
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value && !hasSelected) {
      setQuery(value);
    }
  }, [value]);

  // Fonction de recherche avec Nominatim
  const searchAddress = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
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
        countrycodes: 'fr',
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

      const formattedResults: AutocompleteResult[] = data.map((item: any) => {
        const address = item.address || {};
        const streetParts: string[] = [];
        if (address.house_number) streetParts.push(address.house_number);
        if (address.road) streetParts.push(address.road);

        return {
          placeId: item.place_id.toString(),
          displayName: item.display_name,
          address: streetParts.join(' ') || item.display_name.split(',')[0] || '',
          city: address.city || address.town || address.village || address.municipality || '',
          postcode: address.postcode || '',
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        };
      });

      setResults(formattedResults);
      setShowResults(formattedResults.length > 0);
    } catch (error) {
      console.error('Erreur autocomplétion:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce la recherche
  useEffect(() => {
    if (hasSelected) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddress(query);
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, hasSelected]);

  const handleSelect = (result: AutocompleteResult) => {
    setHasSelected(true);
    setQuery(result.address || result.displayName.split(',')[0]);
    setShowResults(false);
    Keyboard.dismiss();

    onAddressSelect({
      address: result.address || result.displayName.split(',')[0],
      city: result.city,
      postcode: result.postcode,
      latitude: result.latitude,
      longitude: result.longitude,
      displayName: result.displayName,
    });
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    setHasSelected(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setHasSelected(false);
    inputRef.current?.focus();
  };

  const renderResultItem = ({ item }: { item: AutocompleteResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultIcon}>
        <IconSymbol name="location.fill" size={20} color={colors.primary} />
      </View>
      <View style={styles.resultTextContainer}>
        <Text style={styles.resultAddress} numberOfLines={1}>
          {item.address || item.displayName.split(',')[0]}
        </Text>
        <Text style={styles.resultCity} numberOfLines={1}>
          {[item.postcode, item.city].filter(Boolean).join(' ')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputWrapper}>
        <View style={styles.inputContainer}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleChangeText}
            onFocus={() => {
              if (results.length > 0) setShowResults(true);
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
            <FlatList
              data={results}
              keyExtractor={(item) => item.placeId}
              renderItem={renderResultItem}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.resultsList}
            />
          </View>
        )}
      </View>

      {hasSelected && (
        <View style={styles.selectedIndicator}>
          <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} />
          <Text style={styles.selectedText}>Adresse sélectionnée</Text>
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
  input: {
    flex: 1,
    paddingVertical: 16,
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
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
  },
  resultsList: {
    maxHeight: 250,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTextContainer: {
    flex: 1,
  },
  resultAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  resultCity: {
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
});