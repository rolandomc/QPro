import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../src/components/Header';
import ProfileOption from '../../src/components/ProfileOption';
import Badge from '../../src/components/Badge';

export default function ProfileScreen() {
  const xpCurrent = 1250;
  const xpNextLevel = 2000;
  const xpPercentage = (xpCurrent / xpNextLevel) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Info del Usuario y Nivel */}
        <View style={styles.userInfo}>
          <View style={[styles.avatar, styles.neonAvatarBlue]}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
          <Text style={styles.userName}>John Doe</Text>
          <Text style={styles.userHandle}>@johndoe99</Text>

          {/* Rango y Barra de XP */}
          <View style={styles.levelContainer}>
            <Text style={styles.levelTitle}>Rango: <Text style={styles.neonTextOrange}>Estratega</Text></Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPercentage}%` }]} />
            </View>
            <Text style={styles.xpText}>{xpCurrent} / {xpNextLevel} XP para Oráculo</Text>
          </View>
        </View>

        {/* Estadísticas */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.neonCardPurple]}>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Quinielas</Text>
          </View>
          <View style={[styles.statCard, styles.neonCardGreen]}>
            <Text style={styles.statValue}>68%</Text>
            <Text style={styles.statLabel}>Aciertos</Text>
          </View>
        </View>

        {/* Insignias (Logros) */}
        <Text style={styles.sectionTitle}>Tus Logros</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesContainer}>
          <Badge icon="🎯" title="Pleno Perfecto" isUnlocked={true} neonColor="#E91E63" />
          <Badge icon="🔥" title="Racha x3" isUnlocked={true} neonColor="#F39C12" />
          <Badge icon="💰" title="Bolsa Mayor" isUnlocked={false} />
          <Badge icon="🔮" title="Vidente" isUnlocked={false} />
        </ScrollView>

        {/* Menú de Opciones */}
        <Text style={styles.sectionTitle}>Ajustes</Text>
        <ProfileOption icon="⚙️" title="Configuración de la cuenta" />
        <ProfileOption icon="🔔" title="Notificaciones" />
        <ProfileOption icon="🛡️" title="Privacidad y Seguridad" />
        <ProfileOption icon="🚪" title="Cerrar Sesión" />
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  content: { padding: 15, paddingBottom: 40 },
  userInfo: { alignItems: 'center', marginBottom: 25 },
  avatar: { 
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#1C1F26', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2 
  },
  neonAvatarBlue: {
    borderColor: '#3498DB', shadowColor: '#3498DB', shadowOpacity: 0.8, shadowRadius: 15, elevation: 8,
  },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  userName: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  userHandle: { color: '#A0A0A0', fontSize: 14, marginBottom: 15 },
  
  levelContainer: { width: '100%', backgroundColor: '#15181F', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#2A2D35' },
  levelTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  neonTextOrange: { color: '#F39C12', textShadowColor: 'rgba(243, 156, 18, 0.8)', textShadowRadius: 8 },
  xpTrack: { height: 8, backgroundColor: '#1C1F26', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  xpFill: { height: '100%', backgroundColor: '#F39C12', shadowColor: '#F39C12', shadowOpacity: 1, shadowRadius: 5 },
  xpText: { color: '#707070', fontSize: 10, textAlign: 'right' },

  statsRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  statCard: { flex: 1, backgroundColor: '#15181F', borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1.5 },
  neonCardPurple: { borderColor: '#9B59B6', shadowColor: '#9B59B6', shadowOpacity: 0.6, shadowRadius: 10, elevation: 5 },
  neonCardGreen: { borderColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.6, shadowRadius: 10, elevation: 5 },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  statLabel: { color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase' },
  
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 5 },
  badgesContainer: { marginBottom: 30, paddingLeft: 5 },
});