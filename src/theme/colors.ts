// src/theme/colors.ts
// Paleta balanceada modo oscuro — fondos levantados para mejor legibilidad
export const colors = {
  // Fondos principales (más claros que antes para evitar el "pozo negro")
  background:       '#181B22',   // era #0F1115
  backgroundDeep:   '#13151A',   // para modales/overlays
  card:             '#1F2330',   // era #15181F
  cardElevated:     '#252939',   // tarjetas en hover / destacadas
  surface:          '#2A2F40',   // inputs, pills, elementos UI

  // Texto
  text:             '#F0F2F8',   // blanco suavizado (evita burn en pantallas OLED)
  textMuted:        '#9499B0',   // era #A0A0A0 — ahora con tinte azul
  textFaint:        '#5C6180',   // etiquetas terciarias

  // Bordes
  border:           '#333849',   // era #2A2D35
  borderSubtle:     '#262B3A',

  // Acento principal (verde QPro)
  primary:          '#2ECC71',
  primaryDim:       'rgba(46,204,113,0.15)',

  // Colores semánticos
  success:          '#2ECC71',
  warning:          '#F39C12',
  error:            '#E74C3C',
  info:             '#5B9BD5',

  // Notificaciones por tipo
  notifGanador:     '#FFD700',
  notifPerdedor:    '#9499B0',
  notifReembolso:   '#2ECC71',
  notifCerrada:     '#9B59B6',
  notifAnulada:     '#E74C3C',
  notifSpei:        '#5B9BD5',
  notifInfo:        '#5B9BD5',
};
