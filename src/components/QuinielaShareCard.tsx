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

  return (
    <View ref={ref} style={c.card} collapsable={false}>
      {/* ─ Header branding ─ */}
      <View style={c.brandRow}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={c.logo}
          resizeMode="cover"
        />
        <View>
          <Text style={c.brandName}>QPro</Text>
          <Text style={c.brandSlogan}>Quinielas en vivo</Text>
        </View>
        <View style={c.brandSpacer} />
        <View style={c.bolsaPill}>
          <Text style={c.bolsaVal}>{bolsa}</Text>
          <Text style={c.bolsaLbl}>BOLSA</Text>
        </View>
      </View>

      {/* ─ Título ─ */}
      <Text style={c.titulo} numberOfLines={2}>{quiniela?.titulo ?? 'Quiniela'}</Text>

      {/* ─ Usuario ─ */}
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

      {/* ─ Picks ─ */}
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

      {/* ─ Stats ─ */}
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

      {/* ─ Footer ─ */}
      <View style={c.footer}>
        <Text style={c.footerTxt}>Descarga QPro y compite 🏆</Text>
      </View>
    </View>
  );
});

export default QuinielaShareCard;

const BG = '#0A0C10';
const CARD = '#0D1117';
const BORDER = '#1E2330';

const c = StyleSheet.create({
  card: { width: 380, backgroundColor: BG, padding: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  logo: { width: 44, height: 44, borderRadius: 10 },
  brandName: { color: '#FFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  brandSlogan: { color: '#505060', fontSize: 10, letterSpacing: 1.5 },
  brandSpacer: { flex: 1 },
  bolsaPill: { alignItems: 'flex-end', backgroundColor: 'rgba(46,204,113,0.08)', borderWidth: 1, borderColor: '#2ECC7155', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  bolsaVal: { color: '#2ECC71', fontSize: 18, fontWeight: 'bold' },
  bolsaLbl: { color: '#2ECC71', fontSize: 8, letterSpacing: 2, opacity: 0.7 },
  titulo: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 14, lineHeight: 22 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#9B59B622', borderWidth: 1, borderColor: '#9B59B655', justifyContent: 'center', alignItems: 'center' },
  userAvatarTxt: { color: '#9B59B6', fontSize: 14, fontWeight: 'bold' },
  username: { color: '#DDD', fontSize: 14, fontWeight: '600', flex: 1 },
  posPill: { backgroundColor: '#9B59B622', borderWidth: 1, borderColor: '#9B59B655', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  posTxt: { color: '#9B59B6', fontSize: 11, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 10, padding: 10, marginBottom: 6, borderLeftWidth: 3, borderWidth: 1, borderColor: BORDER },
  rowNum: { color: '#404040', fontSize: 10, width: 16, textAlign: 'center' },
  rowIcon: { fontSize: 14 },
  rowCenter: { flex: 1 },
  rowEquipos: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  vs: { color: '#404040', fontWeight: 'normal' },
  rowRes: { fontSize: 10, marginTop: 2 },
  pickBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  pickEmoji: { fontSize: 13 },
  pickLbl: { fontSize: 14, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
  statBox: { alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontWeight: 'bold' },
  statLbl: { color: '#404040', fontSize: 8, letterSpacing: 1.5 },
  footer: { marginTop: 16, alignItems: 'center' },
  footerTxt: { color: '#303040', fontSize: 11, letterSpacing: 1 },
});
