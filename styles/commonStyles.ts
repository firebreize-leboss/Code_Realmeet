
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// ============================================================
// PREMIUM DESIGN SYSTEM - Orange Accent Only
// Inspired by Airbnb, Revolut, premium apps
// Palette: White, Grays (multiple levels), Black, Desaturated Orange
// ============================================================

export const colors = {
  // Primary accent - Desaturated Orange (guide visuel, pas dominant)
  primary: '#D97B4A', // Orange désaturé principal (chaleureux mais calme)
  primaryMuted: '#C4886A', // Orange encore plus doux pour éléments secondaires
  primaryLight: '#F5E6DE', // Orange très pâle pour fonds subtils
  primaryDark: '#B8623A', // Orange foncé pour emphase

  // Pas de couleur secondaire - Orange uniquement comme accent
  secondary: '#D97B4A', // Même que primary (pas de bleu/violet)
  secondaryLight: '#F5E6DE',
  secondaryDark: '#B8623A',

  // Backgrounds - Blanc et nuances de gris très subtiles
  background: '#FAFAFA', // Gris très clair (fond principal)
  backgroundAlt: '#FFFFFF', // Blanc pur (cartes, modales)
  backgroundAccent: '#F5F5F5', // Gris légèrement plus foncé
  backgroundWarm: '#FFFBF8', // Blanc chaud très subtil

  // Text colors - Hiérarchie claire
  text: '#1C1C1E', // Noir/gris très foncé (titres)
  textSecondary: '#48484A', // Gris foncé (descriptions)
  textTertiary: '#8E8E93', // Gris moyen (métadonnées, lieux)
  textMuted: '#AEAEB2', // Gris clair (placeholders, hints)
  textOnPrimary: '#FFFFFF', // Blanc sur fonds colorés

  // Card & Surface
  card: '#FFFFFF', // Blanc pur
  cardBorder: '#E5E5EA', // Gris très subtil
  cardShadow: 'rgba(0, 0, 0, 0.06)', // Ombre très douce

  // Borders & Dividers - Gamme de gris
  border: '#D1D1D6', // Gris bordure standard
  borderLight: '#E5E5EA', // Gris bordure léger
  borderSubtle: '#F2F2F7', // Gris bordure très subtil
  divider: '#E5E5EA', // Lignes de séparation

  // Status colors - Tons naturels
  success: '#34C759', // Vert iOS
  successLight: '#E8F9ED',
  error: '#FF3B30', // Rouge iOS
  errorLight: '#FFE5E5',
  warning: '#D97B4A', // Orange (notre accent)
  warningLight: '#FFF3ED',
  info: '#8E8E93', // Gris (pas de bleu)
  infoLight: '#F2F2F7',

  // Special UI elements
  badge: '#F2F2F7', // Fond gris très clair pour badges discrets
  badgeText: '#48484A', // Texte gris foncé
  badgeAccent: '#D97B4A', // Orange pour badges actifs
  highlight: '#FFFBF8', // Fond blanc chaud
  overlay: 'rgba(0, 0, 0, 0.4)', // Overlay sombre
  overlayLight: 'rgba(0, 0, 0, 0.2)', // Overlay léger
  imageOverlay: 'rgba(0, 0, 0, 0.25)', // Overlay sur images

  // Input fields
  inputBackground: '#F2F2F7', // Gris très clair
  inputBorder: '#D1D1D6', // Gris bordure
  inputFocus: '#D97B4A', // Orange au focus
  inputPlaceholder: '#AEAEB2', // Gris placeholder

  // Prix - Gris foncé ou orange désaturé (pas de bleu)
  price: '#48484A', // Gris foncé par défaut
  priceAccent: '#C4886A', // Orange désaturé (non aguicheur)

  // Category colors - Tous en nuances de gris/orange
  categoryRomance: '#E8D5CE', // Beige rosé
  categoryFood: '#F0E0D0', // Beige chaud
  categoryFestival: '#E5E0E8', // Gris lavande
  categoryBar: '#F0DDD5', // Beige corail
  categoryLeisure: '#E0E8E5', // Gris-vert
  categorySport: '#E0E8E0', // Gris-vert clair
  categoryParty: '#E8E0E8', // Gris-violet
  categoryCulture: '#E0E5E8', // Gris-bleu

  // Accent (legacy compatibility)
  accent: '#D97B4A',
};

// Typography scale
export const typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,

  // Font weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,

  // Line heights
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

// Spacing scale (consistent spacing units)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

// Border radius scale
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999, // For circular elements
};

// Shadow presets for depth
export const shadows = {
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
};

export const commonStyles = StyleSheet.create({
  // Container styles
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

  // Card styles - Modern elevated cards
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

  // Typography styles
  title: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  titleLarge: {
    fontSize: 32,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  heading: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: typography.base,
    color: colors.text,
    lineHeight: typography.base * typography.lineHeightNormal,
  },
  textSecondary: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.sm * typography.lineHeightNormal,
  },
  textTertiary: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    lineHeight: typography.sm * typography.lineHeightNormal,
  },
  textBold: {
    fontWeight: typography.bold,
  },
  textSemibold: {
    fontWeight: typography.semibold,
  },
  textCenter: {
    textAlign: 'center',
  },

  // Button styles - Modern rounded buttons
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  buttonLarge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  buttonSecondary: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  buttonTextOutline: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  buttonTextGhost: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  buttonDisabled: {
    backgroundColor: colors.borderLight,
    opacity: 0.6,
  },
  buttonTextDisabled: {
    color: colors.textSecondary,
  },

  // Input styles - Clean modern inputs
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
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

  // Badge styles
  badge: {
    backgroundColor: colors.badge,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.badgeText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section styles
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
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
  },

  // Divider
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

  // List item styles
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

  // Avatar styles
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

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyStateText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: typography.base * typography.lineHeightRelaxed,
  },

  // Centered content
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Padding & Margin utilities
  p: {
    padding: spacing.lg,
  },
  px: {
    paddingHorizontal: spacing.lg,
  },
  py: {
    paddingVertical: spacing.lg,
  },
  m: {
    margin: spacing.lg,
  },
  mx: {
    marginHorizontal: spacing.lg,
  },
  my: {
    marginVertical: spacing.lg,
  },

  // Flex utilities
  row: {
    flexDirection: 'row',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  column: {
    flexDirection: 'column',
  },
  flex1: {
    flex: 1,
  },
});
