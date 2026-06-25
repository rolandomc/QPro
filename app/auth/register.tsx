import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AuthService } from '../../src/services/auth.service';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await AuthService.signUp(email, password);
      Alert.alert('¡Éxito!', 'Tu cuenta ha sido creada. Revisa tu correo o inicia sesión.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') }
      ]);
    } catch (error: any) {
      Alert.alert('Error al registrar', error.message || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Únete a la mejor plataforma de quinielas</Text>
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
            style={[styles.registerBtn, styles.neonBgPurple]} 
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.registerBtnText}>Registrarse</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>¿Ya tienes cuenta? <Text style={{ color: '#9B59B6', fontWeight: 'bold' }}>Inicia sesión</Text></Text>
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
  title: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#A0A0A0', fontSize: 14 },
  
  form: { backgroundColor: '#15181F', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2A2D35' },
  inputContainer: { marginBottom: 20 },
  label: { color: '#A0A0A0', fontSize: 12, marginBottom: 8 },
  input: { backgroundColor: '#1C1F26', color: '#FFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#2A2D35', fontSize: 16 },
  
  registerBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  neonBgPurple: { backgroundColor: '#9B59B6', shadowColor: '#9B59B6', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  registerBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#A0A0A0', fontSize: 14 },
});