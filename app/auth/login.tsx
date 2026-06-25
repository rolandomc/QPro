import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AuthService } from '../../src/services/auth.service';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu correo y contraseña.');
      return;
    }
    
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
          <Text style={styles.logoTitle}><Text style={styles.neonTextGreen}>STATZ</Text> Quinielas</Text>
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

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput 
              style={styles.input} 
              placeholder="••••••••"
              placeholderTextColor="#707070"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

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
  logoTitle: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  neonTextGreen: { color: '#2ECC71', textShadowColor: 'rgba(46, 204, 113, 0.8)', textShadowRadius: 10 },
  subtitle: { color: '#A0A0A0', fontSize: 14 },
  
  form: { backgroundColor: '#15181F', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2A2D35' },
  inputContainer: { marginBottom: 20 },
  label: { color: '#A0A0A0', fontSize: 12, marginBottom: 8 },
  input: { backgroundColor: '#1C1F26', color: '#FFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#2A2D35', fontSize: 16 },
  
  loginBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  neonBgGreen: { backgroundColor: '#2ECC71', shadowColor: '#2ECC71', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  loginBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#A0A0A0', fontSize: 14 },
});