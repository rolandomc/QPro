import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Alert, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '../../src/components/Header';
import ProfileOption from '../../src/components/ProfileOption';
import Badge from '../../src/components/Badge';
import { AuthService } from '../../src/services/auth.service';
import { AdminService } from '../../src/services/admin.service';
import { supabase } from '../../src/config/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const xpCurrent = 1250;
  const xpNextLevel = 2000;
  const xpPercentage = (xpCurrent / xpNextLevel) * 100;

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Obtener email del usuario autenticado
      const user = await AuthService.getCurrentUser();
      if (user?.email) setUserEmail(user.email);

      // Verificar si es admin
      const adminStatus = await AdminService.isAdmin();
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error cargando perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await AuthService.signOut();
              // _layout.tsx detecta el cambio de sesión y redirige a /auth/login
            } catch (error: any) {
              Alert.alert('Error', error.message);
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  // Iniciales del email para el avatar
  const getInitials = () => {
    if (!userEmail) return '??';
    return userEmail.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2ECC71" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Info del Usuario */}
        <View style={styles.userInfo}>
          <View style={[styles.avatar, styles.neonAvatarBlue]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={styles.userName}>{userEmail}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>👑 ADMIN</Text>
            </View>
          )}

          {/* Barra de XP */}
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

        {/* Insignias */}
        <Text style={styles.sectionTitle}>Tus Logros</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesContainer}>
          <Badge icon="🎯" title="Pleno Perfecto" isUnlocked={true} neonColor="#E91E63" />
          <Badge icon="🔥" title="Racha x3" isUnlocked={true} neonColor="#F39C12" />
          <Badge icon="💰" title="Bolsa Mayor" isUnlocked={false} />
          <Badge icon="🔮" title="Vidente" isUnlocked={false} />
        </ScrollView>

        {/* Panel Admin — solo visible si es admin */}
        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>Panel Administrador</Text>
            <TouchableOpacity
              style={styles.adminCard}
              onPress={() => router.push('/admin')}
            >
              <Text style={styles.adminCardIcon}>🛠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCardTitle}>Gestionar Quinielas</Text>
                <Text style={styles.adminCardSubtitle}>Crear, editar y publicar quinielas</Text>
              </View>
              <Text style={styles.adminCardArrow}>›</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Menú de Opciones */}
        <Text style={styles.sectionTitle}>Ajustes</Text>
        <ProfileOption icon="⚙️" title="Configuración de la cuenta" />
        <ProfileOption icon="🔔" title="Notificaciones" />
        <ProfileOption icon="🛡️" title="Privacidad y Seguridad" />

        {/* Botón Cerrar Sesión */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut
            ? <ActivityIndicator color="#E74C3C" />
            : <Text style={styles.signOutText}>🚨 Cerrar Sesión</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  content: { padding: 15, paddingBottom: 40 },

  userInfo: { alignItems: 'center', marginBottom: 25 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1C1F26', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2 },
  neonAvatarBlue: { borderColor: '#3498DB' },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },

  adminBadge: { backgroundColor: 'rgba(243,156,18,0.15)', borderWidth: 1, borderColor: '#F39C12', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  adminBadgeText: { color: '#F39C12', fontWeight: 'bold', fontSize: 12 },

  levelContainer: { width: '100%', backgroundColor: '#15181F', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#2A2D35' },
  levelTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  neonTextOrange: { color: '#F39C12' },
  xpTrack: { height: 8, backgroundColor: '#1C1F26', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  xpFill: { height: '100%', backgroundColor: '#F39C12' },
  xpText: { color: '#707070', fontSize: 10, textAlign: 'right' },

  statsRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  statCard: { flex: 1, backgroundColor: '#15181F', borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1.5 },
  neonCardPurple: { borderColor: '#9B59B6' },
  neonCardGreen: { borderColor: '#2ECC71' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  statLabel: { color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase' },

  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 5 },
  badgesContainer: { marginBottom: 30, paddingLeft: 5 },

  // Admin card
  adminCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(243,156,18,0.08)', borderWidth: 1, borderColor: '#F39C12', borderRadius: 12, padding: 15, marginBottom: 20 },
  adminCardIcon: { fontSize: 24, marginRight: 12 },
  adminCardTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  adminCardSubtitle: { color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  adminCardArrow: { color: '#F39C12', fontSize: 22 },

  // Sign out
  signOutBtn: { marginTop: 10, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E74C3C', alignItems: 'center', backgroundColor: 'rgba(231,76,60,0.08)' },
  signOutText: { color: '#E74C3C', fontWeight: 'bold', fontSize: 16 },
});
