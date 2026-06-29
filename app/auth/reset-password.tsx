import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase maneja la sesión automáticamente al llegar desde el link del correo
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoTitle}>
            <Text style={styles.neonQ}>Q</Text>
            <Text style={styles.whitePro}>Pro</Text>
          </Text>
          <Text style={styles.subtitle}>
            {done ? '¡Contraseña actualizada!' : 'Nueva contraseña'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {!done ? (
            <>
              <Text style={styles.description}>
                Elige una nueva contraseña segura para tu cuenta.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nueva contraseña</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="#707070"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#A0A0A0" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirmar contraseña</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
                    placeholder="Repite la contraseña"
                    placeholderTextColor="#707070"
                    secureTextEntry={!showConfirm}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                    <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#A0A0A0" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Indicador de fuerza */}
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={[styles.strengthBar, { backgroundColor: password.length >= 6 ? '#2ECC71' : '#E74C3C' }]} />
                  <View style={[styles.strengthBar, { backgroundColor: password.length >= 8 ? '#2ECC71' : '#2A2D35' }]} />
                  <View style={[styles.strengthBar, { backgroundColor: password.length >= 10 ? '#2ECC71' : '#2A2D35' }]} />
                  <Text style={styles.strengthText}>
                    {password.length < 6 ? 'Muy corta' : password.length < 8 ? 'Aceptable' : password.length < 10 ? 'Buena' : 'Excelente'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.neonBgGreen]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.btnText}>Guardar nueva contraseña</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle-outline" size={56} color="#2ECC71" />
              </View>
              <Text style={styles.successTitle}>¡Listo!</Text>
              <Text style={styles.description}>
                Tu contraseña fue actualizada exitosamente. Ya puedes iniciar sesión.
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.neonBgGreen]}
                onPress={() => router.replace('/auth/login')}
              >
                <Text style={styles.btnText}>Iniciar sesión</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoTitle: { fontSize: 48, fontWeight: 'bold', marginBottom: 10 },
  neonQ: { color: '#2ECC71', textShadowColor: 'rgba(46,204,113,0.9)', textShadowRadius: 16, fontSize: 56, fontWeight: 'bold' },
  whitePro: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold' },
  subtitle: { color: '#A0A0A0', fontSize: 14 },

  form: { backgroundColor: '#15181F', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2A2D35' },
  description: { color: '#A0A0A0', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 },

  inputContainer: { marginBottom: 16 },
  label: { color: '#A0A0A0', fontSize: 12, marginBottom: 8 },
  input: { backgroundColor: '#1C1F26', color: '#FFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#2A2D35', fontSize: 16 },

  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35', borderTopRightRadius: 10, borderBottomRightRadius: 10, padding: 15 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, marginTop: -8 },
  strengthBar: { height: 4, flex: 1, borderRadius: 2 },
  strengthText: { color: '#A0A0A0', fontSize: 11, marginLeft: 4 },

  btn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  neonBgGreen: { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  successIcon: { alignItems: 'center', marginBottom: 16 },
  successTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
});
