import { createTheme } from '@mui/material/styles';

// Severity is a distinct semantic scale from the brand accent — see the
// architecture plan, Section 04 (severity chips) and Section 06 (palette).
interface SeverityPalette {
  critical: string;
  high: string;
  medium: string;
  low: string;
}

declare module '@mui/material/styles' {
  interface Palette {
    severity: SeverityPalette;
  }
  interface PaletteOptions {
    severity?: SeverityPalette;
  }
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#276D77', dark: '#164952', contrastText: '#FFFFFF' },
        background: { default: '#F2F5F6', paper: '#FFFFFF' },
        text: { primary: '#16222A', secondary: '#55666E' },
        divider: '#D6DEE1',
        severity: {
          critical: '#A93A2C',
          high: '#B87526',
          medium: '#93801F',
          low: '#3F7A5C',
        },
      },
    },
    dark: {
      palette: {
        primary: { main: '#5BB4BE', dark: '#164952', contrastText: '#0E1517' },
        background: { default: '#0E1517', paper: '#141D20' },
        text: { primary: '#DFE7E9', secondary: '#92A3A9' },
        divider: '#263237',
        severity: {
          critical: '#DD7C68',
          high: '#DFA75E',
          medium: '#CBB65B',
          low: '#7FBB98',
        },
      },
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    h1: { fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif' },
    h2: { fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif' },
    h3: { fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif' },
    h4: { fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif' },
    h5: { fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif' },
    h6: { fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif' },
  },
  shape: { borderRadius: 4 },
});
