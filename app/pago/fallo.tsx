import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function PagoFallo() {
  const router = useRouter();
  const params = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>❌</Text>
      <Text style={styles.title}>Pago no completado</Text>
      <Text style={styles.subtitle}>
        No pudimos procesar tu pago. Puedes intentarlo de nuevo.
      </Text>
      {params.external_reference ? (
        <Text style={styles.ref}>Ref: {params.external_reference}</Text>
      ) : null}
      <TouchableOpacity style={styles.btnPrimary} onPress={() => router.back()}>
        <Text style={styles.btnPrimaryText}>Intentar de nuevo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.btnSecondaryText}>Ir al inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  ref: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 32,
    textAlign: 'center',
  },
  btnPrimary: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  btnSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  btnSecondaryText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 16,
  },
});
