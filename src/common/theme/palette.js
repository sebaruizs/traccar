import { grey } from '@mui/material/colors';

const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

// Ridder: la paleta sale de ridder.com.py (azul #2979ff / #1a56cc, naranja #ff4b26, grises frescos).
export default (server, darkMode) => ({
  mode: darkMode ? 'dark' : 'light',
  background: {
    default: darkMode ? '#0f172a' : '#ffffff',
    paper: darkMode ? '#1e293b' : '#ffffff',
  },
  text: {
    primary: darkMode ? '#f1f5f9' : '#111827',
    secondary: darkMode ? '#94a3b8' : '#6b7280',
  },
  divider: darkMode ? 'rgba(148, 163, 184, 0.24)' : '#e5e7eb',
  primary: {
    main: validatedColor(server?.attributes?.colorPrimary) || (darkMode ? '#5498ff' : '#2979ff'),
    contrastText: '#ffffff',
  },
  secondary: {
    main: validatedColor(server?.attributes?.colorSecondary) || (darkMode ? '#8ab4ff' : '#1a56cc'),
    contrastText: '#ffffff',
  },
  success: {
    main: darkMode ? '#4ade80' : '#16a34a',
    light: darkMode ? '#166534' : '#dcfce7',
    dark: darkMode ? '#86efac' : '#15803d',
    contrastText: darkMode ? '#052e16' : '#ffffff',
  },
  warning: {
    main: darkMode ? '#fbbf24' : '#d97706',
    light: darkMode ? '#78350f' : '#fef3c7',
    dark: darkMode ? '#fcd34d' : '#b45309',
    contrastText: darkMode ? '#451a03' : '#ffffff',
  },
  error: {
    main: darkMode ? '#ff7a59' : '#e8431c',
    light: darkMode ? '#7c2d12' : '#ffedd5',
    dark: darkMode ? '#fdba74' : '#c2410c',
    contrastText: '#ffffff',
  },
  neutral: {
    main: darkMode ? '#94a3b8' : '#9ca3af',
  },
  // Fondo de la fila o el chip seleccionado (celeste de la web de Ridder).
  action: {
    selected: darkMode ? 'rgba(84, 152, 255, 0.22)' : '#e8f0ff',
    hover: darkMode ? 'rgba(148, 163, 184, 0.12)' : '#f3f4f6',
  },
  // Chapa (patente): borde oscuro y franja azul.
  plate: {
    border: darkMode ? '#e2e8f0' : '#111827',
    band: darkMode ? '#5498ff' : '#1a56cc',
    background: darkMode ? '#0f172a' : '#ffffff',
    text: darkMode ? '#f8fafc' : '#111827',
  },
  geometry: {
    main: '#3bb2d0',
  },
  alwaysDark: {
    main: grey[900],
  },
});
