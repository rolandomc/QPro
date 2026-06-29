import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/config/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.qpro.lat/auth/reset-password',
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo enviar el correo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#A0A0A0" />
          </TouchableOpacity>
          <Text style={styles.logoTitle}>
            <Text style={styles.neonQ}>Q</Text>
            <Text style={styles.whitePro}>Pro</Text>
          </Text>
          <Text style={styles.subtitle}>
            {sent ? '¡Correo enviado!' : 'Recupera tu contraseña'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {!sent ? (
            <>
              <Text style={styles.description}>
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Correo Electrónico</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tu@correo.com"
                  placeholderTextColor="#707070"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.neonBgGreen]}
                onPress={handleSend}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.btnText}>Enviar enlace</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.successIcon}>
                <Ionicons name="mail-outline" size={48} color="#2ECC71" />
              </View>
              <Text style={styles.successTitle}>Revisa tu correo</Text>
              <Text style={styles.description}>
                Enviamos un enlace a <Text style={{ color: '#2ECC71' }}>{email}</Text>. Toca el enlace para crear una nueva contraseña.
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.neonBgGreen]}
                onPress={() => router.replace('/auth/login')}
              >
                <Text style={styles.btnText}>Volver al inicio</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>¿Recordaste tu contraseña? <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>Inicia sesión</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },
  header: { alignItems: 'center', marginBottom: 40 },
  backBtn: { position: 'absolute', left: 0, top: 0, padding: 4 },
  logoTitle: { fontSize: 48, fontWeight: 'bold', marginBottom: 10 },
  neonQ: { color: '#2ECC71', textShadowColor: 'rgba(46,204,113,0.9)', textShadowRadius: 16, fontSize: 56, fontWeight: 'bold' },
  whitePro: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold' },
  subtitle: { color: '#A0A0A0', fontSize: 14 },

  form: { backgroundColor: '#15181F', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2A2D35' },
  description: { color: '#A0A0A0', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 },

  inputContainer: { marginBottom: 16 },
  label: { color: '#A0A0A0', fontSize: 12, marginBottom: 8 },
  input: { backgroundColor: '#1C1F26', color: '#FFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#2A2D35', fontSize: 16 },

  btn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  neonBgGreen: { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  successIcon: { alignItems: 'center', marginBottom: 16 },
  successTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },

  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#A0A0A0', fontSize: 14 },
});
