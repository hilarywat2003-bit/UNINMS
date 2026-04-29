import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuthStore } from '../../src/stores/authStore';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login } = useAuthStore();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugMsg, setDebugMsg] = useState('');

  const handleLogin = async () => {
    setDebugMsg(`Trying: "${email.trim()}" / ${password.length} chars`);
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      setDebugMsg('Success!');
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const status  = err?.response?.status;
      const msg =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        err?.message ??
        'Unknown error';
      const debug = `Status: ${status ?? 'no response'} | ${msg}`;
      setDebugMsg(debug);
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ backgroundColor: colors.primary, paddingTop: 80, paddingBottom: 48, alignItems: 'center' }}>
          <View style={{
            width: 72, height: 72, borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Text style={{ fontSize: 32 }}>🎓</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 0.5 }}>UNINMS</Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
            University Research Portal
          </Text>
        </View>

        {/* Form */}
        <View style={{ flex: 1, padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
            Welcome back
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 32 }}>
            Sign in to your account
          </Text>

          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@university.edu"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 15,
              color: colors.text,
              marginBottom: 20,
            }}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoComplete="password"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 15,
              color: colors.text,
              marginBottom: 32,
            }}
          />

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Sign In</Text>
            }
          </TouchableOpacity>

          <Text style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: colors.textMuted }}>
            Contact your institution admin to get access
          </Text>
          <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: colors.textMuted }}>
            API: {process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'}
          </Text>
          {debugMsg ? (
            <Text style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: colors.error, paddingHorizontal: 8 }}>
              {debugMsg}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
