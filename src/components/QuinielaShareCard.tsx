import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const PICK_LABEL: Record<string, string> = { local: '1', empate: 'X', visitante: '2' };
const PICK_EMOJI: Record<string, string> = { local: '🏠', empate: '🤝', visitante: '✈️' };
const RES_LABEL: Record<string, string> = { local: 'Local', empate: 'Empate', visitante: 'Visitante' };

interface Props {
  quiniela: any;
  partidos: any[];
  misSelec: Record<string, string>;
  username?: string;
  miPosicion?: number | null;
  totalParts?: number;
}

const QuinielaShareCard = forwardRef<View, Props>((
  { quiniela, partidos, misSelec, username = 'Jugador', miPosicion, totalParts },
  ref
) => {
  const conRes = partidos.filter((p: any) => p.resultado !== null);
  const aciertos = conRes.filter((p: any) => misSelec[p.id] === p.resultado).length;
  const pct = conRes.length > 0 ? Math.round((aciertos / conRes.length) * 100) : null;
  const pctColor = pct === null ? '#00E5FF' : pct >= 70 ? '#2ECC71' : pct >= 40 ? '#F39C12' : '#E91E63';
  const bolsa = `$${Number(quiniela?.premio_total || 0).toLocaleString()}`;

  // Hora simulada realista
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    // Capa exterior: fondo gris oscuro como wallpaper de teléfono
    <View ref={ref} style={c.phoneWrap} collapsable={false}>

      {/* Marco del teléfono */}
      <View style={c.phoneFrame}>

        {/* Status bar simulada */}
        <View style={c.statusBar}>
          <Text style={c.statusTime}>{timeStr}</Text>
          <View style={c.statusRight}>
            <Text style={c.statusIcon}>••••</Text>
            <Text style={c.statusIcon}>📶</Text>
            <Text style={c.statusIcon}>🔋</Text>
          </View>
        </View>

        {/* Contenido real de la app */}
        <View style={c.appContent}>

          {/* Header de la app */}
          <View style={c.appHeader}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={c.appIcon}
              resizeMode="cover"
            />
            <View style={c.appHeaderText}>
              <Text style={c.appName}>QPro</Text>
              <Text style={c.appSub}>Quinielas en vivo</Text>
            </View>
            <View style={c.bolsaPill}>
              <Text style={c.bolsaVal}>{bolsa}</Text>
              <Text style={c.bolsaLbl}>BOLSA</Text>
            </View>
          </View>

          {/* Título quiniela */}
          <Text style={c.titulo} numberOfLines={2}>{quiniela?.titulo ?? 'Quiniela'}</Text>

          {/* Usuario + posición */}
          <View style={c.userRow}>
            <View style={c.userAvatar}>
              <Text style={c.userAvatarTxt}>{username[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <Text style={c.username}>{username}</Text>
            {miPosicion && totalParts ? (
              <View style={c.posPill}>
                <Text style={c.posTxt}>#{miPosicion} / {totalParts}</Text>
              </View>
            ) : null}
          </View>

          <View style={c.divider} />

          {/* Picks */}
          {partidos.map((p: any, i: number) => {
            const pick = misSelec[p.id];
            const tieneRes = p.resultado !== null;
            const acerto = tieneRes && pick === p.resultado;
            const fallo = tieneRes && !!pick && pick !== p.resultado;
            const neon = acerto ? '#2ECC71' : fallo ? '#E91E63' : '#00E5FF';
            const icon = tieneRes ? (acerto ? '✅' : '❌') : '⏳';
            return (
              <View key={p.id} style={[c.row, { borderLeftColor: neon }]}>
                <Text style={c.rowNum}>{i + 1}</Text>
                <Text style={c.rowIcon}>{icon}</Text>
                <View style={c.rowCenter}>
                  <Text style={c.rowEquipos} numberOfLines={1}>
                    {p.equipo_local}<Text style={c.vs}> vs </Text>{p.equipo_visitante}
                  </Text>
                  {tieneRes && <Text style={[c.rowRes, { color: neon }]}>{RES_LABEL[p.resultado]}</Text>}
                </View>
                <View style={[c.pickBadge, {
                  borderColor: neon,
                  backgroundColor: acerto ? 'rgba(46,204,113,0.12)' : fallo ? 'rgba(233,30,99,0.1)' : 'rgba(0,229,255,0.08)',
                }]}>
                  <Text style={c.pickEmoji}>{pick ? PICK_EMOJI[pick] : '❓'}</Text>
                  <Text style={[c.pickLbl, { color: neon }]}>{pick ? PICK_LABEL[pick] : '?'}</Text>
                </View>
              </View>
            );
          })}

          <View style={c.divider} />

          {/* Stats */}
          <View style={c.statsRow}>
            {pct !== null && (
              <View style={c.statBox}>
                <Text style={[c.statVal, { color: pctColor }]}>{aciertos}/{conRes.length}</Text>
                <Text style={c.statLbl}>ACIERTOS</Text>
              </View>
            )}
            <View style={c.statBox}>
              <Text style={[c.statVal, { color: pctColor }]}>{pct !== null ? `${pct}%` : '—'}</Text>
              <Text style={c.statLbl}>% ACIERTO</Text>
            </View>
            <View style={c.statBox}>
              <Text style={[c.statVal, { color: '#9B59B6' }]}>{partidos.filter((p: any) => p.resultado === null).length}</Text>
              <Text style={c.statLbl}>PENDIENTES</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={c.footer}>
            <Text style={c.footerTxt}>Descarga QPro y compite 🏆</Text>
          </View>

        </View>{/* /appContent */}

        {/* Home indicator */}
        <View style={c.homeIndicatorWrap}>
          <View style={c.homeIndicator} />
        </View>

      </View>{/* /phoneFrame */}
    </View>
  );
});

export default QuinielaShareCard;

const BG = '#0A0C10';
const CARD = '#0D1117';
const BORDER = '#1E2330';

const c = StyleSheet.create({
  // Fondo exterior tipo wallpaper oscuro
  phoneWrap: {
    width: 390,
    backgroundColor: '#05070A',
    padding: 16,
    alignItems: 'center',
  },
  // Marco del teléfono
  phoneFrame: {
    width: 358,
    backgroundColor: BG,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2D3A',
    // Sombra estilo teléfono
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 20,
  },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: BG,
  },
  statusTime: { color: '#FFF', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5 },
  statusRight: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statusIcon: { color: '#FFF', fontSize: 11 },

  // Contenido de la app
  appContent: { paddingHorizontal: 16, paddingBottom: 8 },

  appHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingTop: 4 },
  appIcon: { width: 36, height: 36, borderRadius: 8 },
  appHeaderText: { flex: 0 },
  appName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  appSub: { color: '#505060', fontSize: 9, letterSpacing: 1.5 },
  bolsaPill: {
    marginLeft: 'auto' as any,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1, borderColor: '#2ECC7155',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  bolsaVal: { color: '#2ECC71', fontSize: 16, fontWeight: 'bold' },
  bolsaLbl: { color: '#2ECC71', fontSize: 7, letterSpacing: 2, opacity: 0.7 },

  titulo: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 12, lineHeight: 20 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  userAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#9B59B622', borderWidth: 1, borderColor: '#9B59B655', justifyContent: 'center', alignItems: 'center' },
  userAvatarTxt: { color: '#9B59B6', fontSize: 12, fontWeight: 'bold' },
  username: { color: '#DDD', fontSize: 13, fontWeight: '600', flex: 1 },
  posPill: { backgroundColor: '#9B59B622', borderWidth: 1, borderColor: '#9B59B655', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  posTxt: { color: '#9B59B6', fontSize: 10, fontWeight: 'bold' },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 10 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CARD, borderRadius: 10, padding: 9, marginBottom: 5, borderLeftWidth: 3, borderWidth: 1, borderColor: BORDER },
  rowNum: { color: '#404040', fontSize: 9, width: 14, textAlign: 'center' },
  rowIcon: { fontSize: 12 },
  rowCenter: { flex: 1 },
  rowEquipos: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  vs: { color: '#404040', fontWeight: 'normal' },
  rowRes: { fontSize: 9, marginTop: 2 },
  pickBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
  pickEmoji: { fontSize: 11 },
  pickLbl: { fontSize: 13, fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: CARD, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER },
  statBox: { alignItems: 'center', gap: 2 },
  statVal: { fontSize: 20, fontWeight: 'bold' },
  statLbl: { color: '#404040', fontSize: 7, letterSpacing: 1.5 },

  footer: { marginTop: 12, alignItems: 'center', marginBottom: 4 },
  footerTxt: { color: '#303040', fontSize: 10, letterSpacing: 1 },

  homeIndicatorWrap: { alignItems: 'center', paddingBottom: 10, paddingTop: 6 },
  homeIndicator: { width: 120, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF30' },
});
