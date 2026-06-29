import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../src/services/auth.service';

const STORAGE_KEY = 'qpro_saved_email';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { setEmail(saved); setRememberEmail(true); }
    } catch {}
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu correo y contraseña.');
      return;
    }
    try {
      if (rememberEmail) localStorage.setItem(STORAGE_KEY, email);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setLoading(true);
    try {
      await AuthService.signIn(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error al iniciar sesión', error.message || 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logoTitle}>
            <Text style={styles.neonQ}>Q</Text>
            <Text style={styles.whitePro}>Pro</Text>
          </Text>
          <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        </View>

        <View style={styles.form}>
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

          {/* Recordar correo */}
          <TouchableOpacity style={styles.checkRow} onPress={() => setRememberEmail(!rememberEmail)}>
            <View style={[styles.checkbox, rememberEmail && styles.checkboxActive]}>
              {rememberEmail && <Ionicons name="checkmark" size={12} color="#000" />}
            </View>
            <Text style={styles.checkLabel}>Recordar correo</Text>
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
                placeholder="••••••••"
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

          {/* Olvidaste tu contraseña */}
          <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/auth/forgot-password')}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, styles.neonBgGreen]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.loginBtnText}>Iniciar Sesión</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/auth/register')}>
            <Text style={styles.linkText}>¿No tienes cuenta? <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>Regístrate aquí</Text></Text>
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
  logoTitle: { fontSize: 48, fontWeight: 'bold', marginBottom: 10 },
  neonQ: { color: '#2ECC71', textShadowColor: 'rgba(46,204,113,0.9)', textShadowRadius: 16, fontSize: 56, fontWeight: 'bold' },
  whitePro: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold' },
  subtitle: { color: '#A0A0A0', fontSize: 14 },

  form: { backgroundColor: '#15181F', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2A2D35' },
  inputContainer: { marginBottom: 16 },
  label: { color: '#A0A0A0', fontSize: 12, marginBottom: 8 },
  input: { backgroundColor: '#1C1F26', color: '#FFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#2A2D35', fontSize: 16 },

  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35', borderTopRightRadius: 10, borderBottomRightRadius: 10, padding: 15 },

  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: -8 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#2ECC71', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxActive: { backgroundColor: '#2ECC71' },
  checkLabel: { color: '#A0A0A0', fontSize: 13 },

  forgotBtn: { alignItems: 'flex-end', marginTop: -8, marginBottom: 16 },
  forgotText: { color: '#2ECC71', fontSize: 13 },

  loginBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  neonBgGreen: { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  loginBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#A0A0A0', fontSize: 14 },
});
