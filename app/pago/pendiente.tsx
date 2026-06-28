import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function PagoPendiente() {
  const router = useRouter();
  const params = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Pago pendiente</Text>
      <Text style={styles.subtitle}>
        Tu pago está siendo procesado. Te notificaremos cuando se confirme.
      </Text>
      {params.external_reference ? (
        <Text style={styles.ref}>Ref: {params.external_reference}</Text>
      ) : null}
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.btnText}>Ir al inicio</Text>
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
    color: '#F59E0B',
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
  btn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 16,
  },
  btnText: {
    color: '#0A0C10',
    fontWeight: '700',
    fontSize: 16,
  },
});
