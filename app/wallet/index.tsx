import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QuickRechargeButton from '../../src/components/QuickRechargeButton';
import TransactionItem from '../../src/components/TransactionItem';

export default function WalletScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState(1250);

  const movimientos = [
    { id: 1, tipo: 'Depósito', monto: '+ $500.00', fecha: '22 Jun 2026', color: '#2ECC71' },
    { id: 2, tipo: 'Apuesta: Quiniela Mundial', monto: '- $150.00', fecha: '20 Jun 2026', color: '#E91E63' },
    { id: 3, tipo: 'Retiro', monto: '- $1,000.00', fecha: '15 Jun 2026', color: '#FFF' },
  ];

  const handleRecharge = (amount: number) => {
    setBalance(prev => prev + amount);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mi Billetera</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Balance Card */}
        <View style={[styles.balanceCard, styles.neonCardGreen]}>
          <Text style={styles.balanceLabel}>Saldo Disponible</Text>
          <Text style={styles.balanceValue}>
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} <Text style={styles.currency}>MXN</Text>
          </Text>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.depositBtn}>
              <Text style={styles.depositText}>Ingresar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.withdrawBtn}>
              <Text style={styles.withdrawText}>Retirar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Carga Rápida */}
        <Text style={styles.sectionTitle}>Recarga Rápida</Text>
        <View style={styles.quickRechargeRow}>
          <QuickRechargeButton amount={100} onPress={() => handleRecharge(100)} />
          <QuickRechargeButton amount={200} onPress={() => handleRecharge(200)} />
          <QuickRechargeButton amount={500} onPress={() => handleRecharge(500)} />
        </View>

        {/* Gráfico Simulado de Gastos vs Ingresos */}
        <Text style={styles.sectionTitle}>Resumen del Mes</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBarContainer}>
            <View style={[styles.chartBar, styles.incomeBar, { height: '80%' }]} />
            <Text style={styles.chartLabel}>Ingresos</Text>
          </View>
          <View style={styles.chartBarContainer}>
            <View style={[styles.chartBar, styles.expenseBar, { height: '40%' }]} />
            <Text style={styles.chartLabel}>Gastos</Text>
          </View>
        </View>

        {/* Movimientos */}
        <Text style={styles.sectionTitle}>Últimos Movimientos</Text>
        <View style={styles.historyContainer}>
          {movimientos.map((mov) => (
            <TransactionItem 
              key={mov.id}
              tipo={mov.tipo}
              monto={mov.monto}
              fecha={mov.fecha}
              color={mov.color}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2D35' },
  backButton: { width: 60 },
  backText: { color: '#2ECC71', fontSize: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 15, paddingBottom: 40 },
  
  balanceCard: { backgroundColor: '#15181F', borderRadius: 16, padding: 25, alignItems: 'center', marginBottom: 20 },
  neonCardGreen: { borderColor: '#2ECC71', borderWidth: 1.5, shadowColor: '#2ECC71', shadowOpacity: 0.6, shadowRadius: 15, elevation: 10 },
  balanceLabel: { color: '#A0A0A0', fontSize: 14, marginBottom: 10 },
  balanceValue: { color: '#FFF', fontSize: 36, fontWeight: 'bold', marginBottom: 25, textShadowColor: 'rgba(255, 255, 255, 0.3)', textShadowRadius: 10 },
  currency: { fontSize: 16, color: '#2ECC71' },
  
  actionRow: { flexDirection: 'row', gap: 15, width: '100%' },
  depositBtn: { flex: 1, backgroundColor: '#2ECC71', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  depositText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  withdrawBtn: { flex: 1, backgroundColor: '#1C1F26', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2A2D35' },
  withdrawText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  quickRechargeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, marginHorizontal: -4 },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 5 },
  
  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#15181F', borderRadius: 16, padding: 20, height: 150, marginBottom: 25, borderWidth: 1, borderColor: '#2A2D35' },
  chartBarContainer: { alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: 40, borderRadius: 6, marginBottom: 10 },
  incomeBar: { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.6, shadowRadius: 8 },
  expenseBar: { backgroundColor: '#E91E63', shadowColor: '#E91E63', shadowOpacity: 0.6, shadowRadius: 8 },
  chartLabel: { color: '#A0A0A0', fontSize: 12 },
  
  historyContainer: { backgroundColor: '#15181F', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#2A2D35' },
});