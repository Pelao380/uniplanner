// Colores de la app, en claro y oscuro según el sistema (como "sistema" en la web).
import { useColorScheme } from 'react-native';

const claro = {
  fondo: '#F4F5FB',
  tarjeta: '#FFFFFF',
  texto: '#1B1D2A',
  suave: '#666B80',
  borde: '#DDE0EC',
  primario: '#4F46E5',
  sobrePrimario: '#FFFFFF',
  ok: '#15803D',
  okFondo: '#DCFCE7',
  mal: '#B91C1C',
  malFondo: '#FEE2E2',
  aviso: '#92400E',
  avisoFondo: '#FEF3C7',
};

const oscuro = {
  fondo: '#0F1117',
  tarjeta: '#1A1D27',
  texto: '#ECEDF3',
  suave: '#9A9FB5',
  borde: '#2C3040',
  primario: '#818CF8',
  sobrePrimario: '#0F1117',
  ok: '#4ADE80',
  okFondo: '#123321',
  mal: '#F87171',
  malFondo: '#3A1616',
  aviso: '#FCD34D',
  avisoFondo: '#3A2E0E',
};

export const useTema = () => (useColorScheme() === 'dark' ? oscuro : claro);

export const STATUS_LABEL = {
  'sin-notas': 'Sin notas',
  'en-curso': 'En curso',
  asegurado: 'Aprobación asegurada',
  imposible: 'Ya no alcanza',
  aprobado: 'Aprobado',
  reprobado: 'Reprobado',
};
