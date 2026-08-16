import { createTheme } from '@mui/material/styles';

// Same register as the portfolio: near-black ground, one hot accent that means
// exactly one thing, hairline borders instead of shadows, square corners, heavy
// uppercase display type with a mono face for every label and annotation.
//
// Two departures, both because this is a thing you hold in a sweaty hand
// between sets rather than a thing you read on a desk:
//   - controls are sized for thumbs (44px minimum), not for cursors
//   - every number is tabular so a weight column doesn't wobble as it changes

export const ink = {
  ground: '#08080a',
  surface: '#0f0f12',
  raised: '#16161b',
  line: '#26262e',
  lineBright: '#3a3a46',
  text: '#f4f4f0',
  dim: '#8b8b96',
  accent: '#ff4d17',
  accentDim: '#c53a10',
  cool: '#12e0c8',
};

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, "Cascadia Mono", monospace';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: ink.accent, light: '#ff7a4d', dark: ink.accentDim, contrastText: ink.ground },
    secondary: { main: ink.cool, contrastText: ink.ground },
    success: { main: ink.cool },
    background: { default: ink.ground, paper: ink.surface },
    text: { primary: ink.text, secondary: ink.dim },
    divider: ink.line,
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 900, letterSpacing: '-0.045em', textTransform: 'uppercase', lineHeight: 0.96 },
    h2: { fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase', lineHeight: 1 },
    h3: { fontWeight: 800, letterSpacing: '-0.02em' },
    h4: { fontWeight: 800, letterSpacing: '-0.02em', textTransform: 'uppercase' },
    h5: { fontWeight: 800, letterSpacing: '-0.02em', textTransform: 'uppercase' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    button: {
      textTransform: 'uppercase',
      fontWeight: 700,
      letterSpacing: '0.1em',
      fontSize: '0.78rem',
    },
    overline: {
      fontFamily: MONO,
      letterSpacing: '0.14em',
      fontWeight: 600,
      fontSize: '0.72rem',
      lineHeight: 1.6,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Lift numbers are read at a glance, mid-set. Proportional digits make
        // a column of weights shift horizontally every time one changes.
        'input, .num': { fontVariantNumeric: 'tabular-nums' },
        // The number spinners are unhittable on a phone and steal width from
        // the digits; the app ships its own +/- steppers instead.
        'input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button':
          { WebkitAppearance: 'none', margin: 0 },
        'input[type=number]': { MozAppearance: 'textfield' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 0, boxShadow: 'none', minHeight: 44, '&:hover': { boxShadow: 'none' } },
        sizeSmall: { minHeight: 36 },
        contained: { '&:hover': { backgroundColor: '#e0430f' } },
        outlined: {
          borderColor: ink.line,
          color: ink.text,
          '&:hover': { borderColor: ink.text, backgroundColor: 'transparent' },
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 0 } } },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: MONO,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '0.68rem',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundImage: 'none',
          boxShadow: 'none',
          border: `1px solid ${ink.line}`,
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 0, border: `1px solid ${ink.line}` } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontWeight: 800, letterSpacing: '-0.01em', textTransform: 'uppercase', fontSize: '1.05rem' },
      },
    },
    MuiAppBar: { styleOverrides: { root: { boxShadow: 'none', backgroundImage: 'none' } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 0, border: `1px solid ${ink.line}` },
        standardError: { backgroundColor: 'rgba(255,77,23,0.08)', color: ink.text },
        standardInfo: { backgroundColor: 'rgba(18,224,200,0.06)', color: ink.text },
        standardSuccess: { backgroundColor: 'rgba(18,224,200,0.06)', color: ink.text },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: ink.raised,
          '& fieldset': { borderColor: ink.line },
          '&:hover fieldset': { borderColor: ink.lineBright },
        },
        input: { fontVariantNumeric: 'tabular-nums' },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.75rem' },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          borderColor: ink.line,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          fontSize: '0.72rem',
          minHeight: 40,
          '&.Mui-selected': { backgroundColor: ink.accent, color: ink.ground },
          '&.Mui-selected:hover': { backgroundColor: '#e0430f' },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 0, height: 2, backgroundColor: ink.line } },
    },
    MuiBottomNavigation: {
      styleOverrides: { root: { backgroundColor: ink.surface, height: 60 } },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: { color: ink.dim, '&.Mui-selected': { color: ink.accent } },
        label: {
          fontFamily: MONO,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontSize: '0.62rem',
          fontWeight: 600,
          '&.Mui-selected': { fontSize: '0.62rem' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: ink.line, fontVariantNumeric: 'tabular-nums' },
        head: {
          fontFamily: MONO,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontSize: '0.66rem',
          color: ink.dim,
          fontWeight: 600,
        },
      },
    },
    MuiSkeleton: { styleOverrides: { root: { borderRadius: 0, backgroundColor: ink.raised } } },
    MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 0 } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none', borderColor: ink.line } } },
  },
});

export default theme;
