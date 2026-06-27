import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AuthService } from '../../src/services/auth.service';

// ─── Utilidades ───
function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function buildUsername(nombre: string, apellido: string): string {
  const n = slugify(nombre);
  const a = slugify(apellido);
  if (!n && !a) return '';
  if (!a) return n;
  return `${n}${a}`;
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: '', color: '#1C1F26' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score, label: 'Débil', color: '#E91E63' };
  if (score <= 3) return { score, label: 'Regular', color: '#F39C12' };
  return { score, label: 'Segura', color: '#2ECC71' };
}

// Elimina el outline azul en web
const noOutline = Platform.OS === 'web'
  ? { outlineWidth: 0, outlineStyle: 'none' } as any
  : {};

// ─── Campo reutilizable ───
function Field({ label, placeholder, value, onChangeText, keyboardType, autoCapitalize, secureTextEntry, prefix }: any) {
  return (
    <View style={s.inputContainer}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputWrap}>
        {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
        <TextInput
          style={[s.input, noOutline]}
          placeholder={placeholder}
          placeholderTextColor="#505060"
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          secureTextEntry={secureTextEntry}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}

// ─── Pantalla ───
export default function RegisterScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!usernameTouched) setUsername(buildUsername(nombre, apellido));
  }, [nombre, apellido, usernameTouched]);

  const strength = getPasswordStrength(password);
  const strengthPct = Math.min((strength.score / 5) * 100, 100);

  const handleRegister = async () => {
    if (!nombre.trim() || !apellido.trim()) {
      Alert.alert('Faltan datos', 'Ingresa tu nombre y apellido.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Faltan datos', 'El nombre de usuario no puede estar vacío.');
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('Faltan datos', 'Ingresa tu correo y contraseña.');
      return;
    }
    if (strength.score <= 1) {
      Alert.alert('Contraseña débil', 'Usa al menos 8 caracteres, una mayúscula y un número.');
      return;
    }
    setLoading(true);
    try {
      await AuthService.signUp(email, password, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        username: username.trim(),
        display_name: `${nombre.trim()} ${apellido.trim()}`,
      });
      Alert.alert('¡Éxito!', 'Tu cuenta ha sido creada. Revisa tu correo o inicia sesión.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') },
      ]);
    } catch (error: any) {
      Alert.alert('Error al registrar', error.message || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Espacio flexible arriba para centrar */}
        <View style={{ flex: 1 }} />

        <View style={s.header}>
          <Text style={s.title}>Crea tu cuenta</Text>
          <Text style={s.subtitle}>Únete a la mejor plataforma de quinielas</Text>
        </View>

        <View style={s.form}>

          {/* Nombre + Apellido */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field label="Nombre" placeholder="Juan" value={nombre} onChangeText={setNombre} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Field label="Apellido" placeholder="Pérez" value={apellido} onChangeText={setApellido} />
            </View>
          </View>

          {/* Username */}
          <View style={s.inputContainer}>
            <Text style={s.label}>Usuario</Text>
            <View style={s.inputWrap}>
              <Text style={s.prefix}>@</Text>
              <TextInput
                style={[s.input, { paddingLeft: 2 }, noOutline]}
                placeholder="tu_usuario"
                placeholderTextColor="#505060"
                autoCapitalize="none"
                value={username}
                onChangeText={(v) => {
                  setUsernameTouched(true);
                  setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                }}
              />
            </View>
            <Text style={s.hint}>Se genera automáticamente · puedes cambiarlo</Text>
          </View>

          {/* Email */}
          <Field
            label="Correo Electrónico"
            placeholder="tu@correo.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Contraseña + barra de seguridad */}
          <View style={s.inputContainer}>
            <Text style={s.label}>Contraseña</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={[s.input, noOutline]}
                placeholder="••••••••"
                placeholderTextColor="#505060"
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
                <Text style={s.eyeTxt}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Barra */}
            <View style={s.strengthWrap}>
              <View style={s.strengthTrack}>
                <View style={[
                  s.strengthFill,
                  { width: `${strengthPct}%` as any, backgroundColor: strength.color, shadowColor: strength.color },
                ]} />
              </View>
              {strength.label ? (
                <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              ) : null}
            </View>

            {/* Reglas */}
            {password.length > 0 && (
              <View style={s.rules}>
                <Rule ok={password.length >= 8} text="Mínimo 8 caracteres" />
                <Rule ok={/[A-Z]/.test(password)} text="Una mayúscula" />
                <Rule ok={/[0-9]/.test(password)} text="Un número" />
                <Rule ok={/[^A-Za-z0-9]/.test(password)} text="Un símbolo (!@#$…)" />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={s.btnTxt}>Crear cuenta</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.linkBtn} onPress={() => router.back()}>
            <Text style={s.linkTxt}>¿Ya tienes cuenta? <Text style={s.linkAccent}>Inicia sesión</Text></Text>
          </TouchableOpacity>
        </View>

        {/* Espacio flexible abajo para centrar */}
        <View style={{ flex: 1 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={s.ruleRow}>
      <Text style={[s.ruleDot, { color: ok ? '#2ECC71' : '#404040' }]}>{ok ? '✓' : '●'}</Text>
      <Text style={[s.ruleTxt, { color: ok ? '#2ECC71' : '#505060' }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },

  header: { alignItems: 'center', marginBottom: 24 },
  title: { color: '#FFF', fontSize: 26, fontWeight: 'bold', marginBottom: 6 },
  subtitle: { color: '#606070', fontSize: 13 },

  form: {
    backgroundColor: '#0D1117',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E2330',
    gap: 4,
  },
  row: { flexDirection: 'row' },

  inputContainer: { marginBottom: 16 },
  label: { color: '#808090', fontSize: 11, letterSpacing: 1, marginBottom: 7, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131620',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2330',
    paddingHorizontal: 14,
    height: 50,
  },
  prefix: { color: '#9B59B6', fontSize: 16, fontWeight: 'bold', marginRight: 2 },
  input: { flex: 1, color: '#FFF', fontSize: 15 },
  hint: { color: '#404050', fontSize: 10, marginTop: 5, letterSpacing: 0.5 },

  eyeBtn: { padding: 4 },
  eyeTxt: { fontSize: 16 },

  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthTrack: { flex: 1, height: 4, backgroundColor: '#1A1D24', borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2, shadowOpacity: 0.7, shadowRadius: 4 },
  strengthLabel: { fontSize: 11, fontWeight: 'bold', width: 48, textAlign: 'right' },

  rules: { marginTop: 8, gap: 3 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleDot: { fontSize: 11, width: 14, textAlign: 'center' },
  ruleTxt: { fontSize: 11 },

  btn: {
    backgroundColor: '#9B59B6',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#9B59B6',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  btnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 },

  linkBtn: { marginTop: 18, alignItems: 'center' },
  linkTxt: { color: '#606070', fontSize: 13 },
  linkAccent: { color: '#9B59B6', fontWeight: 'bold' },
});
