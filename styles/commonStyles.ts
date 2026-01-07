
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// Modern 2025 Light Theme Color Palette
// Inspired by Tinder, Bumble BFF, Timeleft, Meetup
export const colors = {
  // Primary brand color - Vibrant Coral/Pink gradient feel
  primary: '#FF6B9D', // Vibrant coral-pink (main accent)
  primaryLight: '#FFB3D9', // Light pink for hover/pressed states
  primaryDark: '#E63E7A', // Darker pink for emphasis

  // Secondary accent - Complementary turquoise/teal
  secondary: '#3ABFEF', // Bright turquoise blue
  secondaryLight: '#7DD3F7', // Light turquoise
  secondaryDark: '#2196D4', // Darker blue

  // Backgrounds - Light & Airy
  background: '#FAFAFA', // Very light gray (main background)
  backgroundAlt: '#FFFFFF', // Pure white (cards, modals)
  backgroundAccent: '#F5F5F5', // Slightly darker for contrast

  // Text colors - High contrast on light backgrounds
  text: '#1A1A1A', // Very dark gray (almost black) for primary text
  textSecondary: '#666666', // Medium gray for secondary text
  textTertiary: '#999999', // Light gray for tertiary text/placeholders
  textOnPrimary: '#FFFFFF', // White text on colored backgrounds

  // Card & Surface
  card: '#FFFFFF', // White cards
  cardBorder: '#E8E8E8', // Subtle border
  cardShadow: 'rgba(0, 0, 0, 0.08)', // Soft shadow

  // Borders & Dividers
  border: '#E0E0E0', // Light border
  borderLight: '#F0F0F0', // Very light border
  divider: '#EEEEEE', // Divider lines

  // Status colors
  success: '#4CAF50', // Green for success
  successLight: '#81C784', // Light green
  error: '#EF5350', // Red for errors
  errorLight: '#E57373', // Light red
  warning: '#FFA726', // Orange for warnings
  warningLight: '#FFB74D', // Light orange
  info: '#42A5F5', // Blue for info
  infoLight: '#64B5F6', // Light blue

  // Special UI elements
  badge: '#FF6B9D', // Badge color (primary)
  badgeText: '#FFFFFF', // Badge text
  highlight: '#FFF3E0', // Highlight background (very light orange)
  overlay: 'rgba(0, 0, 0, 0.5)', // Dark overlay for modals
  overlayLight: 'rgba(0, 0, 0, 0.3)', // Lighter overlay

  // Input fields
  inputBackground: '#F7F7F7', // Light gray input background
  inputBorder: '#DDDDDD', // Input border
  inputFocus: '#FF6B9D', // Primary color on focus
  inputPlaceholder: '#AAAAAA', // Placeholder text

  // Category colors (softened pastels for light theme)
  categoryRomance: '#FFB3D9', // Soft pink
  categoryFood: '#FFD580', // Soft orange
  categoryFestival: '#D1A3E6', // Soft purple
  categoryBar: '#FFB380', // Soft coral
  categoryLeisure: '#80E6D9', // Soft teal
  categorySport: '#A8E6A3', // Soft green
  categoryParty: '#C880E6', // Soft violet
  categoryCulture: '#80C8FF', // Soft blue
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
