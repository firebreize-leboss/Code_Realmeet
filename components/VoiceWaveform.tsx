// components/VoiceWaveform.tsx
// Waveform audio style Instagram — barres modulées par l'intensité, remplissage progressif en lecture

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

const NUM_BARS = 20;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT = 22;

interface VoiceWaveformProps {
  /** Tableau de niveaux normalisés (0-1) pour chaque barre */
  levels: number[];
  /** Progression de la lecture (0-1), 0 = pas encore lu */
  progress?: number;
  /** true si c'est un message envoyé par l'utilisateur courant */
  isOwnMessage?: boolean;
}

/**
 * Génère une waveform déterministe à partir d'un ID de message.
 * Donne des hauteurs de barres visuellement plaisantes et cohérentes pour un même ID.
 */
export function generateWaveformFromId(id: string, numBars: number = NUM_BARS): number[] {
  const bars: number[] = [];
  for (let i = 0; i < numBars; i++) {
    const c1 = id.charCodeAt(i % id.length);
    const c2 = id.charCodeAt((i + 3) % id.length);
    const c3 = id.charCodeAt((i + 7) % id.length);
    // Hash simple qui donne une bonne distribution
    const raw = ((c1 * 31 + c2 * 17 + c3 * 13 + i * 41) % 100) / 100;
    // Forme en cloche pour un aspect naturel : plus haut au milieu
    const bellCurve = Math.sin((i / (numBars - 1)) * Math.PI);
    const value = 0.15 + raw * 0.55 + bellCurve * 0.3;
    bars.push(Math.min(1, value));
  }
  return bars;
}

export default function VoiceWaveform({ levels, progress = 0, isOwnMessage = false }: VoiceWaveformProps) {
  // Normaliser les niveaux au nombre de barres attendu
  const normalizedLevels = useMemo(() => {
    if (levels.length === 0) return Array(NUM_BARS).fill(0.2);
    if (levels.length === NUM_BARS) return levels;
    // Resample si le nombre ne correspond pas
    const result: number[] = [];
    for (let i = 0; i < NUM_BARS; i++) {
      const srcIdx = (i / NUM_BARS) * levels.length;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, levels.length - 1);
      const frac = srcIdx - lo;
      result.push(levels[lo] * (1 - frac) + levels[hi] * frac);
    }
    return result;
  }, [levels]);

  const filledBars = Math.floor(progress * NUM_BARS);
  const partialFill = (progress * NUM_BARS) - filledBars;

  return (
    <View style={styles.container}>
      {normalizedLevels.map((level, i) => {
        const height = MIN_BAR_HEIGHT + level * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT);
        const isFilled = i < filledBars;
        const isPartial = i === filledBars && partialFill > 0;

        // Couleurs
        const filledColor = isOwnMessage ? 'rgba(255,255,255,0.95)' : '#E07A3D';
        const unfilledColor = isOwnMessage ? 'rgba(255,255,255,0.35)' : '#D1D5DB';

        return (
          <View key={i} style={[styles.barWrapper, { height }]}>
            {/* Barre de fond (non remplie) */}
            <View
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: isFilled ? filledColor : unfilledColor,
                },
              ]}
            />
            {/* Remplissage partiel pour la barre en cours */}
            {isPartial && (
              <View
                style={[
                  styles.barPartialOverlay,
                  {
                    height: height * partialFill,
                    backgroundColor: filledColor,
                  },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_GAP,
    flex: 1,
  },
  barWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  barPartialOverlay: {
    position: 'absolute',
    bottom: 0,
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
});
