import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../src/services/auth.service';
import { FloatInput } from '../../src/components/FloatInput';

const STORAGE_KEY = 'qpro_saved_email';

export default function LoginScreen() {
  const router = useRouter();
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);
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

        {/* Logo */}
        <View style={styles.header}>
          <Text style={styles.logoTitle}>
            <Text style={styles.neonQ}>Q</Text>
            <Text style={styles.whitePro}>Pro</Text>
          </Text>
          <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        </View>

        <View style={styles.form}>
          {/* Email */}
          <FloatInput
            label="Correo Electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Recordar correo */}
          <TouchableOpacity style={styles.checkRow} onPress={() => setRememberEmail(!rememberEmail)}>
            <View style={[styles.checkbox, rememberEmail && styles.checkboxActive]}>
              {rememberEmail && <Ionicons name="checkmark" size={12} color="#000" />}
            </View>
            <Text style={styles.checkLabel}>Recordar correo</Text>
          </TouchableOpacity>

          {/* Contraseña */}
          <FloatInput
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            rightIcon={
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#808090"
              />
            }
            onRightIconPress={() => setShowPassword(v => !v)}
          />

          {/* Olvidé contraseña */}
          <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/auth/forgot-password')}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {/* Botón login */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.loginBtnText}>Iniciar Sesión</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/auth/register')}>
            <Text style={styles.linkText}>
              ¿No tienes cuenta?{' '}
              <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>Regístrate aquí</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0A0C10' },
  content:    { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },

  header:     { alignItems: 'center', marginBottom: 40 },
  logoTitle:  { fontSize: 48, fontWeight: 'bold', marginBottom: 10 },
  neonQ:      { color: '#2ECC71', textShadowColor: 'rgba(46,204,113,0.9)', textShadowRadius: 16, fontSize: 56, fontWeight: 'bold' },
  whitePro:   { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold' },
  subtitle:   { color: '#A0A0A0', fontSize: 14 },

  form: {
    backgroundColor: '#0D1117',
    padding:         20,
    borderRadius:    16,
    borderWidth:      1,
    borderColor:     '#1E2330',
  },

  checkRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: -8 },
  checkbox:      { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#2ECC71', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxActive: { backgroundColor: '#2ECC71' },
  checkLabel:    { color: '#A0A0A0', fontSize: 13 },

  forgotBtn:  { alignItems: 'flex-end', marginTop: -8, marginBottom: 16 },
  forgotText: { color: '#2ECC71', fontSize: 13 },

  loginBtn: {
    backgroundColor: '#2ECC71',
    padding:         15,
    borderRadius:    12,
    alignItems:      'center',
    marginTop:       4,
    shadowColor:     '#2ECC71',
    shadowOpacity:   0.6,
    shadowRadius:    10,
    elevation:       8,
  },
  loginBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  linkBtn:  { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#A0A0A0', fontSize: 14 },
});
