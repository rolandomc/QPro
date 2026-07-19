import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PagoExito() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const paymentId = String(params.payment_id ?? params.collection_id ?? '');
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!paymentId || !supabaseUrl) return;

    fetch(`${supabaseUrl}/functions/v1/mercadopago-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'payment', data: { id: paymentId } }),
    }).catch(() => null);
  }, [params.collection_id, params.payment_id]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>¡Pago exitoso!</Text>
      <Text style={styles.subtitle}>
        Tu participación ha sido confirmada. Ya puedes ver tu quiniela.
      </Text>
      {params.external_reference ? (
        <Text style={styles.ref}>Ref: {params.external_reference}</Text>
      ) : null}
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.btnText}>Ir a mis quinielas</Text>
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
    color: '#2ECC71',
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
    backgroundColor: '#2ECC71',
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
