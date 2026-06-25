import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Simulamos los datos que vendrán de Supabase
const QUINIELAS_ACTIVAS = [
  { id: 'Q-001', liga: 'Mundial 2026', jornada: 'Fase de Grupos', usuarios: 145, bolsa: 7250, estado: 'Activa', color: '#2ECC71' },
  { id: 'Q-002', liga: 'Premier League', jornada: '12', usuarios: 8, bolsa: 400, estado: 'Poco Quórum', color: '#F39C12' },
  { id: 'Q-003', liga: 'Liga MX', jornada: 'Liguilla', usuarios: 450, bolsa: 22500, estado: 'Cerrada (En Juego)', color: '#3498DB' },
];

export default function AdminDashboardScreen() {
  const router = useRouter();

  const handleCancel = (id: string) => {
    Alert.alert("Cancelar Quiniela", `¿Estás seguro que deseas cancelar la quiniela ${id}? Se reembolsará el dinero a los usuarios.`, [
      { text: "No", style: "cancel" },
      { text: "Sí, Cancelar", style: "destructive", onPress: () => console.log("Cancelada") }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Panel Admin</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Métricas Globales */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>603</Text>
            <Text style={styles.statLabel}>Usuarios Activos</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#2A2D35' }]}>
            <Text style={[styles.statValue, { color: '#2ECC71' }]}>$30,150</Text>
            <Text style={styles.statLabel}>Bolsa Total</Text>
          </View>
        </View>

        {/* Botón Principal para Crear */}
        <TouchableOpacity 
          style={[styles.createBtn, styles.neonBorderPurple]}
          onPress={() => router.push('/admin/create')}
        >
          <Text style={styles.createBtnText}>+ Diseñar Nueva Quiniela</Text>
        </TouchableOpacity>

        {/* Gestión de Quinielas Existentes */}
        <Text style={styles.sectionTitle}>Quinielas en Curso</Text>
        
        {QUINIELAS_ACTIVAS.map((q) => (
          <View key={q.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{q.liga} - J{q.jornada}</Text>
              <View style={[styles.badge, { borderColor: q.color }]}>
                <Text style={[styles.badgeText, { color: q.color }]}>{q.estado}</Text>
              </View>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.infoText}>👥 {q.usuarios} participantes</Text>
              <Text style={styles.infoText}>💰 Bolsa: <Text style={{ color: '#2ECC71', fontWeight: 'bold'}}>${q.bolsa} MXN</Text></Text>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn}>
                <Text style={styles.actionText}>Ver Usuarios</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Text style={styles.actionText}>Cerrar Apuestas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={() => handleCancel(q.id)}>
                <Text style={styles.dangerText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backButton: { width: 60 },
  backText: { color: '#9B59B6', fontSize: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 15, paddingBottom: 40 },
  
  statsContainer: { flexDirection: 'row', backgroundColor: '#15181F', borderRadius: 12, paddingVertical: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2A2D35' },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  statLabel: { color: '#A0A0A0', fontSize: 12 },

  createBtn: { backgroundColor: '#1C1F26', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 30, borderWidth: 1.5 },
  neonBorderPurple: { borderColor: '#9B59B6', shadowColor: '#9B59B6', shadowOpacity: 0.6, shadowRadius: 10, elevation: 5 },
  createBtnText: { color: '#9B59B6', fontWeight: 'bold', fontSize: 16 },

  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  
  card: { backgroundColor: '#15181F', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#2A2D35' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  
  cardInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#1C1F26', padding: 10, borderRadius: 8 },
  infoText: { color: '#A0A0A0', fontSize: 12 },

  cardActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  actionBtn: { flex: 1, backgroundColor: '#1C1F26', paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  actionText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  dangerBtn: { borderColor: '#E91E63', backgroundColor: 'rgba(233, 30, 99, 0.1)' },
  dangerText: { color: '#E91E63', fontSize: 12, fontWeight: 'bold' }
});