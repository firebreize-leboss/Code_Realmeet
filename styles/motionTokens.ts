// styles/motionTokens.ts
// Motion design tokens — all animations use only transform + opacity (UI thread)

export const motion = {
  duration: {
    instant: 80,    // feedback tactile immédiat
    fast: 120,      // micro-interactions (scale press, opacity)
    normal: 200,    // transitions standard
    slow: 320,      // entrées d'écran, modales
  },
  spring: {
    // Spring "snappy" pour press/release
    snappy: { damping: 15, stiffness: 300 },
    // Spring "smooth" pour indicateur tab bar
    smooth: { damping: 20, stiffness: 200 },
    // Spring "bouncy" pour succès/like
    bouncy: { damping: 10, stiffness: 250 },
  },
  scale: {
    press: 0.96,     // scale pendant appui
    pop: 1.08,       // scale peak pour like/favori
    normal: 1.0,
  },
};
