
import { StyleSheet, TextStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';

// ============================================================================
// REALMEET — DESIGN SYSTEM
// ============================================================================
//
// Principes (à respecter dans tout l'app) :
//
// 1. CHALEUREUX MAIS SOBRE
//    L'orange #F2994A est un GUIDE visuel ponctuel (CTA, focus, accents).
//    Jamais dominant. Le fond reste blanc/gris très clair, les surfaces
//    respirent.
//
// 2. WHITESPACE GÉNÉREUX
//    Préférer spacing.xl/xxl entre blocs, padding lg/xl dans les cartes.
//    Une UI aérée = perçue comme premium et calme.
//
// 3. TYPOGRAPHIE EXPRESSIVE
//    Manrope est LA font officielle (chargée dans app/_layout.tsx).
//    Utiliser fontFamily.* (jamais de système font hardcodée).
//    Utiliser typographyPresets.* pour les styles de texte canoniques.
//
// 4. ANIMATIONS SENSIBLES
//    Durées courtes (motion.duration.fast/base), easings doux
//    (motion.easing.standard pour les transitions, motion.spring.gentle
//    pour les apparitions). Reanimated UNIQUEMENT — pas Animated.
//
// 5. PROFONDEUR SUBTILE
//    Ombres légères (shadows.sm/md). Jamais de shadow xl sans raison.
//    Préférer la séparation par couleur de fond + bordure subtile.
//
// 6. RAYONS GÉNÉREUX
//    radius.md (12) ou lg (16) par défaut. Ne descendre à sm qu'en
//    cas d'élément serré. radius.full uniquement pour avatars/badges.
//
// 7. ACCESSIBILITÉ
//    Hit slop minimum hitSlop.md (8) sur toute zone tactile < 44pt.
//    Contraste texte sur fond toujours >= 4.5:1.
//
// ============================================================================

// ============================================================================
// COLORS — Palette canonique RealMeet
// ============================================================================

export const colors = {
  // ── Primary accent : Premium Intermediate Orange ─────────────────────────
  // #F2994A : équilibre entre énergie et chaleur — guide visuel, pas dominant.
  primary: '#F2994A',
  primaryMuted: '#D4A574',                       // Orange désaturé pour icônes/badges secondaires
  primaryDesaturated: 'rgba(242, 153, 74, 0.70)', // Orange atténué pour accents subtils
  primaryLight: '#FEF4EB',                       // Orange très pâle pour fonds subtils
  primaryDark: '#D97B2F',                        // Orange sombre pour états press/active
  primaryPressed: '#C26C20',                     // Orange encore plus sombre pour active

  // ── Secondary (alias primary — pas de couleur secondaire dans la DA) ────
  secondary: '#F2994A',
  secondaryLight: '#FEF4EB',
  secondaryDark: '#D97B2F',

  // ── Backgrounds ──────────────────────────────────────────────────────────
  background: '#FAFAFA',         // Fond principal (gris très clair)
  backgroundAlt: '#FFFFFF',      // Cartes, modales
  backgroundAccent: '#F5F5F5',   // Fond légèrement plus marqué
  backgroundWarm: '#FFFBF8',     // Blanc chaud (sections premium)
  backgroundElevated: '#FFFFFF', // Surfaces élevées (drawers, sheets)

  // ── Text ─────────────────────────────────────────────────────────────────
  text: '#1C1C1E',           // Titres, contenu principal
  textSecondary: '#48484A',  // Descriptions
  textTertiary: '#8E8E93',   // Métadonnées, lieux
  textMuted: '#AEAEB2',      // Placeholders, hints
  textDisabled: '#C7C7CC',   // États désactivés
  textOnPrimary: '#FFFFFF',  // Texte sur fond orange/sombre
  textInverse: '#FFFFFF',    // Alias pour textOnPrimary

  // ── Surfaces ─────────────────────────────────────────────────────────────
  card: '#FFFFFF',
  cardBorder: '#E5E5EA',
  cardShadow: 'rgba(0, 0, 0, 0.06)',

  // ── Borders & Dividers ───────────────────────────────────────────────────
  border: '#D1D1D6',
  borderLight: '#E5E5EA',
  borderSubtle: '#F2F2F7',
  divider: '#E5E5EA',

  // ── Status ───────────────────────────────────────────────────────────────
  success: '#34C759',
  successLight: '#E8F9ED',
  successDark: '#248A3D',
  error: '#FF3B30',
  errorLight: '#FFE5E5',
  errorDark: '#C9190E',
  warning: '#F2994A',         // Volontairement = primary (chaleur cohérente)
  warningLight: '#FEF4EB',
  warningDark: '#D97B2F',
  info: '#8E8E93',            // Gris (pas de bleu dans la DA)
  infoLight: '#F2F2F7',

  // ── Special UI ───────────────────────────────────────────────────────────
  badge: '#F2F2F7',
  badgeText: '#48484A',
  badgeAccent: '#F2994A',
  highlight: '#FFFBF8',
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
  overlayDark: 'rgba(0, 0, 0, 0.6)',
  imageOverlay: 'rgba(0, 0, 0, 0.25)',
  scrim: 'rgba(28, 28, 30, 0.55)', // Pour bottom sheets

  // ── Inputs ───────────────────────────────────────────────────────────────
  inputBackground: '#F2F2F7',
  inputBorder: '#D1D1D6',
  inputFocus: '#F2994A',
  inputPlaceholder: '#AEAEB2',
  inputDisabled: '#F5F5F5',

  // ── Prix ─────────────────────────────────────────────────────────────────
  price: '#48484A',
  priceAccent: '#D4A574',

  // ── Catégories (tons doux pour harmonie visuelle) ────────────────────────
  categoryRomance: '#E8D5CE',
  categoryFood: '#F0E0D0',
  categoryFestival: '#E5E0E8',
  categoryBar: '#F0DDD5',
  categoryLeisure: '#E0E8E5',
  categorySport: '#E0E8E0',
  categoryParty: '#E8E0E8',
  categoryCulture: '#E0E5E8',

  // ── Compatibilité legacy ────────────────────────────────────────────────
  accent: '#F2994A',
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

/**
 * Police officielle RealMeet : Manrope.
 * Chargée dans app/_layout.tsx. Toujours référencer via fontFamily.* —
 * jamais de string brute pour permettre un swap futur.
 */
export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

/**
 * Échelle typographique. Garde xs..xxxl + display pour les titres hero.
 */
export const typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 32,        // Hero / page titles
  displayLarge: 40,   // Splash / onboarding only

  // Font weights (utilisés en fallback quand fontFamily n'est pas appliqué)
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,

  // Line heights (multiplicateurs)
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

/**
 * Letter spacing tokens. Utiliser les valeurs négatives pour les gros titres
 * (resserre l'optique) et positives pour les labels en uppercase.
 */
export const letterSpacing = {
  tighter: -0.7,  // Display
  tight: -0.5,    // Title
  normal: 0,      // Body
  wide: 0.3,      // Captions
  wider: 0.5,     // Badges uppercase
  widest: 1.2,    // Badges très accentués
} as const;

/**
 * PRESETS TYPOGRAPHIQUES — appliquer un texte canonique en une ligne :
 *
 *   <Text style={typographyPresets.heading2}>Titre</Text>
 *
 * Préférer ces presets à la combinaison manuelle de fontFamily + fontSize.
 */
export const typographyPresets = {
  display: {
    fontFamily: fontFamily.bold,
    fontSize: typography.displayLarge,
    lineHeight: typography.displayLarge * typography.lineHeightTight,
    letterSpacing: letterSpacing.tighter,
    color: colors.text,
  } as TextStyle,

  heading1: {
    fontFamily: fontFamily.bold,
    fontSize: typography.display,
    lineHeight: typography.display * typography.lineHeightTight,
    letterSpacing: letterSpacing.tight,
    color: colors.text,
  } as TextStyle,

  heading2: {
    fontFamily: fontFamily.bold,
    fontSize: typography.xxxl,
    lineHeight: typography.xxxl * typography.lineHeightTight,
    letterSpacing: letterSpacing.tight,
    color: colors.text,
  } as TextStyle,

  heading3: {
    fontFamily: fontFamily.bold,
    fontSize: typography.xxl,
    lineHeight: typography.xxl * typography.lineHeightTight,
    color: colors.text,
  } as TextStyle,

  heading4: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.xl,
    lineHeight: typography.xl * typography.lineHeightTight,
    color: colors.text,
  } as TextStyle,

  subtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.lg,
    lineHeight: typography.lg * typography.lineHeightNormal,
    color: colors.text,
  } as TextStyle,

  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: typography.lg,
    lineHeight: typography.lg * typography.lineHeightNormal,
    color: colors.text,
  } as TextStyle,

  body: {
    fontFamily: fontFamily.regular,
    fontSize: typography.base,
    lineHeight: typography.base * typography.lineHeightNormal,
    color: colors.text,
  } as TextStyle,

  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: typography.base,
    lineHeight: typography.base * typography.lineHeightNormal,
    color: colors.text,
  } as TextStyle,

  bodySemibold: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.base,
    lineHeight: typography.base * typography.lineHeightNormal,
    color: colors.text,
  } as TextStyle,

  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: typography.sm,
    lineHeight: typography.sm * typography.lineHeightNormal,
    color: colors.textSecondary,
  } as TextStyle,

  caption: {
    fontFamily: fontFamily.medium,
    fontSize: typography.xs,
    lineHeight: typography.xs * typography.lineHeightNormal,
    color: colors.textTertiary,
  } as TextStyle,

  label: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.xs,
    lineHeight: typography.xs * typography.lineHeightTight,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  } as TextStyle,

  buttonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.base,
    lineHeight: typography.base * typography.lineHeightTight,
    letterSpacing: 0.2,
  } as TextStyle,

  link: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.base,
    color: colors.primary,
  } as TextStyle,
};

// ============================================================================
// SPACING — échelle 4px
// ============================================================================

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 56,  // Ajouté : pour sections hero
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  none: 0,
  xs: 4,        // Ajouté : éléments très petits
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,     // Ajouté : sheets, modals plein écran
  full: 9999,   // Avatars, badges pilule
};

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  /**
   * Ombre orange subtile pour les CTA primaires hero.
   * Donne un effet "glow" chaleureux sans saturer la palette.
   */
  primaryGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
};

// ============================================================================
// MOTION — Animation tokens (Reanimated)
// ============================================================================
//
// Règle d'or : préférer toujours motion.duration.* + motion.easing.* à des
// valeurs hardcodées. Springs pour les apparitions / gestures, timings pour
// les transitions d'état déterministes.
//
// ============================================================================

export const motion = {
  /** Durées en ms — court = réactif, long = expressif */
  duration: {
    instant: 100,   // Feedback tactile immédiat
    fast: 180,      // Hover, pressed states
    base: 240,      // Transitions standard (in/out)
    slow: 320,      // Apparitions notables (modals, sheets)
    slower: 480,    // Transitions emphase (success, hero)
    page: 350,      // Transitions de navigation entre écrans
  },

  /** Courbes d'easing Reanimated */
  easing: {
    /** Standard out — sortie douce, idéal pour entrées */
    standard: Easing.bezier(0.2, 0.0, 0.0, 1.0),
    /** Decelerate — ralentit en fin, pour apparitions */
    decelerate: Easing.bezier(0.0, 0.0, 0.2, 1.0),
    /** Accelerate — accélère, pour disparitions */
    accelerate: Easing.bezier(0.4, 0.0, 1.0, 1.0),
    /** Sharp — transitions brèves et nettes */
    sharp: Easing.bezier(0.4, 0.0, 0.6, 1.0),
    /** Emphasized — pour transitions importantes (Material 3 emphasized) */
    emphasized: Easing.bezier(0.2, 0.0, 0.0, 1.0),
  },

  /**
   * Configurations de spring (à passer à `withSpring(value, motion.spring.X)`)
   *
   * - snappy : interactions tactiles, boutons, toggles (réactif)
   * - gentle : apparitions de cartes, modals (calme)
   * - bouncy : feedback positif (success, like, confetti)
   * - stiff  : retour rapide à un état (reset, snap)
   */
  spring: {
    snappy: {
      damping: 18,
      stiffness: 220,
      mass: 1,
    },
    gentle: {
      damping: 22,
      stiffness: 140,
      mass: 1,
    },
    bouncy: {
      damping: 12,
      stiffness: 200,
      mass: 1,
    },
    stiff: {
      damping: 26,
      stiffness: 300,
      mass: 1,
    },
  },

  /** Échelles de feedback tactile pour press states */
  pressScale: {
    subtle: 0.98,
    normal: 0.96,
    strong: 0.94,
  },
} as const;

// ============================================================================
// OPACITY — états visuels canoniques
// ============================================================================

export const opacity = {
  disabled: 0.4,
  pressed: 0.7,
  inactive: 0.6,
  hover: 0.85,
  full: 1,
} as const;

// ============================================================================
// Z-INDEX — empilement canonique
// ============================================================================

export const zIndex = {
  base: 0,
  raised: 10,        // Cards élevées
  dropdown: 100,     // Menus, dropdowns
  sticky: 200,       // Headers sticky
  overlay: 300,      // Overlays fond
  modal: 400,        // Modals, sheets
  popover: 500,      // Popovers, tooltips
  toast: 600,        // Toasts, snackbars
  topmost: 9999,     // Splash, loaders critiques
} as const;

// ============================================================================
// HIT SLOP — accessibilité tactile
// ============================================================================

/**
 * Hit slop standard à appliquer sur toute zone tactile dont la taille
 * visuelle est inférieure à 44pt (recommandation Apple HIG).
 *
 *   <Pressable hitSlop={hitSlop.md} ... />
 */
export const hitSlop = {
  sm: { top: 6, right: 6, bottom: 6, left: 6 },
  md: { top: 8, right: 8, bottom: 8, left: 8 },
  lg: { top: 12, right: 12, bottom: 12, left: 12 },
  xl: { top: 16, right: 16, bottom: 16, left: 16 },
} as const;

// ============================================================================
// LAYOUT — constantes de layout partagées
// ============================================================================

export const layout = {
  /** Largeur max du contenu central (tablettes) */
  maxContentWidth: 720,
  /** Hauteur standard d'un input */
  inputHeight: 52,
  /** Hauteur standard d'un bouton primaire */
  buttonHeight: 52,
  /** Hauteur standard du tab bar flottant */
  tabBarHeight: 64,
  /** Hauteur d'un header standard */
  headerHeight: 56,
  /** Taille tactile minimale (Apple HIG) */
  minTouchTarget: 44,
} as const;

// ============================================================================
// COMMON STYLES — primitives réutilisables
// ============================================================================

export const commonStyles = StyleSheet.create({
  // ── Containers ────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerWhite: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  cardCompact: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardLarge: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  cardNoBorder: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  // ── Typography (legacy — préférer typographyPresets pour les nouveaux écrans) ─
  title: {
    fontFamily: fontFamily.bold,
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: letterSpacing.tight,
  },
  titleLarge: {
    fontFamily: fontFamily.bold,
    fontSize: typography.display,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: letterSpacing.tighter,
  },
  subtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  heading: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  text: {
    fontFamily: fontFamily.regular,
    fontSize: typography.base,
    color: colors.text,
    lineHeight: typography.base * typography.lineHeightNormal,
  },
  textSecondary: {
    fontFamily: fontFamily.regular,
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.sm * typography.lineHeightNormal,
  },
  textTertiary: {
    fontFamily: fontFamily.regular,
    fontSize: typography.sm,
    color: colors.textTertiary,
    lineHeight: typography.sm * typography.lineHeightNormal,
  },
  textBold: {
    fontFamily: fontFamily.bold,
    fontWeight: typography.bold,
  },
  textSemibold: {
    fontFamily: fontFamily.semibold,
    fontWeight: typography.semibold,
  },
  textCenter: {
    textAlign: 'center',
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  buttonLarge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  buttonSecondary: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
    letterSpacing: 0.2,
  },
  buttonTextOutline: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  buttonTextGhost: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    backgroundColor: colors.borderLight,
    opacity: opacity.disabled,
  },
  buttonTextDisabled: {
    color: colors.textSecondary,
  },

  // ── Inputs ────────────────────────────────────────────────────────────────
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    minHeight: layout.inputHeight,
    fontFamily: fontFamily.regular,
    fontSize: typography.base,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  inputFocused: {
    borderColor: colors.inputFocus,
    backgroundColor: colors.backgroundAlt,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing.lg,
    textAlignVertical: 'top',
  },

  // ── Badges ────────────────────────────────────────────────────────────────
  badge: {
    backgroundColor: colors.badge,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.badgeText,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wider,
  },
  badgeOutline: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignSelf: 'flex-start',
  },
  badgeOutlineText: {
    fontFamily: fontFamily.semibold,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wider,
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
  },

  // ── Dividers ──────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.lg,
  },
  dividerThick: {
    height: 2,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  // ── List items ────────────────────────────────────────────────────────────
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  listItemNoBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    marginBottom: 1,
  },

  // ── Avatars ───────────────────────────────────────────────────────────────
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.borderLight,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.borderLight,
  },
  avatarXLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.borderLight,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyStateText: {
    fontFamily: fontFamily.regular,
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: typography.base * typography.lineHeightRelaxed,
  },

  // ── Centering ─────────────────────────────────────────────────────────────
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Padding & Margin utilities ────────────────────────────────────────────
  p: { padding: spacing.lg },
  px: { paddingHorizontal: spacing.lg },
  py: { paddingVertical: spacing.lg },
  m: { margin: spacing.lg },
  mx: { marginHorizontal: spacing.lg },
  my: { marginVertical: spacing.lg },

  // ── Flex utilities ────────────────────────────────────────────────────────
  row: { flexDirection: 'row' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  column: { flexDirection: 'column' },
  flex1: { flex: 1 },
});

// ============================================================================
// EXPORTS GROUPÉS — facilitent l'import en bloc :
//
//   import { theme } from '@/styles/commonStyles';
//   theme.colors.primary
//   theme.motion.spring.snappy
//   theme.typographyPresets.heading2
// ============================================================================

export const theme = {
  colors,
  fontFamily,
  typography,
  typographyPresets,
  letterSpacing,
  spacing,
  borderRadius,
  shadows,
  motion,
  opacity,
  zIndex,
  hitSlop,
  layout,
} as const;

export type Theme = typeof theme;
