import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation } from 'react-native';

interface Seleccion {
  partido_id: string;
  prediccion: 'local' | 'empate' | 'visitante';
  partido: {
    equipo_local: string;
    equipo_visitante: string;
    fecha_partido: string;
    resultado: 'local' | 'empate' | 'visitante' | null;
  };
}

interface Props {
  quiniela: {
    titulo: string;
    precio_entrada: number;
    estado: string;
  };
  participacion: {
    id: string;
    aciertos: number | null;
    estado: string;
    created_at: string;
  };
  selecciones: Seleccion[];
  modo: 'en_juego' | 'historial';
}

const LABEL: Record<string, string> = {
  local: '1',
  empate: 'X',
  visitante: '2',
};

export default function ResultCard({ quiniela, participacion, selecciones, modo }: Props) {
  const [expandido, setExpandido] = useState(false);

  const total = selecciones.length;
  const conResultado = selecciones.filter(s => s.partido.resultado !== null);
  const aciertos = conResultado.filter(s => s.prediccion === s.partido.resultado).length;
  const pendientes = total - conResultado.length;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandido(prev => !prev);
  };

  const fecha = new Date(participacion.created_at).toLocaleDateString('es-MX', { dateStyle: 'medium' });

  return (
    <View style={[styles.card, modo === 'historial' ? styles.cardHistorial : styles.cardEnJuego]}>
      {/* Cabecera */}
      <TouchableOpacity onPress={toggle} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quinielaTitulo} numberOfLines={1}>{quiniela.titulo}</Text>
            <Text style={styles.fechaText}>Participaste el {fecha}</Text>
          </View>
          <View style={styles.statsBox}>
            {modo === 'historial' ? (
              <View style={styles.aciertosBox}>
                <Text style={styles.aciertosNum}>{aciertos}</Text>
                <Text style={styles.aciertosLabel}>/{total}</Text>
              </View>
            ) : (
              <View style={styles.pendienteBox}>
                <Text style={styles.pendienteNum}>{pendientes}</Text>
                <Text style={styles.pendienteLabel}>pendientes</Text>
              </View>
            )}
          </View>
          <Text style={styles.chevron}>{expandido ? '▲' : '▼'}</Text>
        </View>

        {/* Barra de progreso de aciertos */}
        {modo === 'historial' && (
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              { width: `${total > 0 ? (aciertos / total) * 100 : 0}%` },
              aciertos / total >= 0.7 ? styles.fillVerde : aciertos / total >= 0.4 ? styles.fillAmarillo : styles.fillRojo,
            ]} />
          </View>
        )}
      </TouchableOpacity>

      {/* Detalle expandible */}
      {expandido && (
        <View style={styles.detalleContainer}>
          {selecciones.map((s, i) => {
            const tieneResultado = s.partido.resultado !== null;
            const esAcierto = tieneResultado && s.prediccion === s.partido.resultado;
            const esFallo = tieneResultado && s.prediccion !== s.partido.resultado;

            return (
              <View key={s.partido_id} style={styles.seleccionRow}>
                <Text style={styles.seleccionNum}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.seleccionEquipos} numberOfLines={1}>
                    {s.partido.equipo_local} vs {s.partido.equipo_visitante}
                  </Text>
                </View>
                <View style={[
                  styles.pronosticoBadge,
                  esAcierto && styles.badgeVerde,
                  esFallo && styles.badgeRojo,
                  !tieneResultado && styles.badgePendiente,
                ]}>
                  <Text style={[
                    styles.pronosticoText,
                    esAcierto && { color: '#2ECC71' },
                    esFallo && { color: '#E91E63' },
                  ]}>
                    {LABEL[s.prediccion] ?? s.prediccion}
                  </Text>
                </View>
                {tieneResultado && (
                  <Text style={styles.resultadoIcon}>{esAcierto ? '✅' : '❌'}</Text>
                )}
                {!tieneResultado && (
                  <Text style={styles.pendienteIcon}>⏳</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, padding: 15, marginBottom: 14, borderWidth: 1.5,
    backgroundColor: '#15181F',
  },
  cardEnJuego: { borderColor: '#3498DB' },
  cardHistorial: { borderColor: '#2A2D35' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quinielaTitulo: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  fechaText: { color: '#707070', fontSize: 11, marginTop: 2 },

  statsBox: { alignItems: 'center' },
  aciertosBox: { flexDirection: 'row', alignItems: 'baseline' },
  aciertosNum: { color: '#2ECC71', fontSize: 22, fontWeight: 'bold' },
  aciertosLabel: { color: '#A0A0A0', fontSize: 13 },

  pendienteBox: { alignItems: 'center' },
  pendienteNum: { color: '#3498DB', fontSize: 22, fontWeight: 'bold' },
  pendienteLabel: { color: '#A0A0A0', fontSize: 10 },

  chevron: { color: '#505050', fontSize: 12, marginLeft: 4 },

  progressTrack: {
    height: 4, backgroundColor: '#1C1F26',
    borderRadius: 2, marginTop: 10, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  fillVerde: { backgroundColor: '#2ECC71' },
  fillAmarillo: { backgroundColor: '#F39C12' },
  fillRojo: { backgroundColor: '#E91E63' },

  detalleContainer: {
    marginTop: 12, borderTopWidth: 1,
    borderTopColor: '#2A2D35', paddingTop: 12, gap: 10,
  },
  seleccionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seleccionNum: { color: '#505050', fontSize: 11, width: 18, textAlign: 'right' },
  seleccionEquipos: { color: '#A0A0A0', fontSize: 12 },

  pronosticoBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#2A2D35',
    minWidth: 32, alignItems: 'center',
  },
  badgeVerde: { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.1)' },
  badgeRojo: { borderColor: '#E91E63', backgroundColor: 'rgba(233,30,99,0.1)' },
  badgePendiente: { borderColor: '#3498DB', backgroundColor: 'rgba(52,152,219,0.1)' },
  pronosticoText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  resultadoIcon: { fontSize: 14 },
  pendienteIcon: { fontSize: 14 },
});
