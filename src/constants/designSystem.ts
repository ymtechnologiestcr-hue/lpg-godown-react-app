import { TextStyle } from 'react-native';

/**
 * Purchase Manager design system.
 *
 * Mirrors the shared design standards (Typography, Colors, Buttons, Inputs).
 * Scoped to the purchase-manager screens so the rest of the app (godown /
 * cashier) keeps using the legacy `COLORS` palette untouched.
 */

// ---------------------------------------------------------------------------
// Raw palette (matches the "Colors" board: Primary / Grey / semantic scales)
// ---------------------------------------------------------------------------
export const PALETTE = {
  // Primary — indigo
  primary900: '#171B5C',
  primary800: '#212986',
  primary700: '#2A34A6',
  primary600: '#3340C4',
  primary500: '#3D4FE0',
  primary400: '#6470E8',
  primary300: '#9098EF',
  primary200: '#BEC3F6',
  primary100: '#E0E3FB',
  primary50: '#EEEFFD',

  // Grey
  grey900: '#1A2130',
  grey800: '#2A3242',
  grey700: '#3D4658',
  grey600: '#556070',
  grey500: '#7A8494',
  grey400: '#9BA3B0',
  grey300: '#C3C9D2',
  grey200: '#E1E4E9',
  grey100: '#EDEFF2',
  grey50: '#F6F7F9',

  // Green / Success
  green700: '#1C6B3A',
  green600: '#238A4A',
  green500: '#2FA25A',
  green100: '#D8F2E2',
  green50: '#E9F7EF',
  greenText: '#15803D',

  // Red / Danger
  red700: '#9E2C2F',
  red600: '#D3383D',
  red500: '#E5484D',
  red100: '#FAD9DA',
  red50: '#FCEDED',

  // Yellow / Warning
  yellow700: '#B45309',
  yellow600: '#DB8E0A',
  yellow500: '#F2A017',
  yellow100: '#FCE9C6',
  yellow50: '#FEF4E2',
  yellowText: '#B45309',

  // Blue / Info
  blue700: '#0369A1',
  blue600: '#0B84D4',
  blue500: '#1B9DEF',
  blue100: '#D2ECFC',
  blue50: '#E7F4FE',

  white: '#FFFFFF',
  black: '#0B0D12',
};

// ---------------------------------------------------------------------------
// Semantic tokens — this superset keeps every legacy `COLORS.*` key so the
// screens can move over with a single import swap.
// ---------------------------------------------------------------------------
export const DS = {
  // brand
  primary: PALETTE.primary500,
  primaryHover: PALETTE.primary600,
  primaryPress: PALETTE.primary800,
  primaryDark: PALETTE.primary900,
  primarySoft: PALETTE.primary50,
  primarySoftBorder: PALETTE.primary100,

  // neutrals
  white: PALETTE.white,
  black: PALETTE.black,
  background: '#F4F5F7',
  card: PALETTE.white,
  surface: PALETTE.grey50,

  textPrimary: PALETTE.grey900,
  textSecondary: PALETTE.grey500,
  textTertiary: PALETTE.grey400,
  mutedText: PALETTE.grey400,
  border: PALETTE.grey200,
  borderStrong: PALETTE.grey300,
  divider: PALETTE.grey100,

  // disabled (buttons / inputs)
  disabledBg: PALETTE.grey200,
  disabledText: PALETTE.grey400,

  // semantic
  green: PALETTE.green500,
  greenSoft: PALETTE.green50,
  greenText: PALETTE.greenText,
  buttonGreen: '#1FA84D',
  red: PALETTE.red500,
  redSoft: PALETTE.red50,
  orange: PALETTE.yellow500,
  orangeSoft: PALETTE.yellow50,
  orangeText: PALETTE.yellowText,
  blue: PALETTE.blue500,
  blueSoft: PALETTE.blue50,
  blueText: PALETTE.blue700,

  // grey ramp passthrough
  grey900: PALETTE.grey900,
  grey700: PALETTE.grey700,
  grey500: PALETTE.grey500,
  grey400: PALETTE.grey400,
  grey300: PALETTE.grey300,
  grey200: PALETTE.grey200,
  grey100: PALETTE.grey100,
  grey50: PALETTE.grey50,
};

// ---------------------------------------------------------------------------
// Typography — "Text Font" scale. All headings Semi Bold (600), no letter
// spacing (0) unless the token is an uppercase label.
// ---------------------------------------------------------------------------
export const WEIGHT = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

const t = (
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle['fontWeight']
): TextStyle => ({ fontSize, lineHeight, fontWeight });

export const TYPO = {
  h1: t(48, 58, WEIGHT.semibold),
  h2: t(40, 48, WEIGHT.semibold),
  h3: t(32, 38, WEIGHT.semibold),
  h4: t(28, 34, WEIGHT.semibold),
  h5: t(24, 28, WEIGHT.semibold),

  s1: t(18, 28, WEIGHT.semibold),
  s2: t(16, 24, WEIGHT.semibold),

  b1: t(16, 24, WEIGHT.regular),
  b2: t(16, 24, WEIGHT.medium),
  b3: t(14, 20, WEIGHT.regular),
  b4: t(14, 20, WEIGHT.medium),

  c1: t(12, 16, WEIGHT.regular),
  c2: t(12, 16, WEIGHT.medium),
  c3: t(10, 14, WEIGHT.medium),

  label: t(12, 16, WEIGHT.medium),
};

// Uppercase "eyebrow" label used for section headers.
export const EYEBROW: TextStyle = {
  ...TYPO.label,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
};

// ---------------------------------------------------------------------------
// Shape tokens
// ---------------------------------------------------------------------------
export const RADIUS = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};
