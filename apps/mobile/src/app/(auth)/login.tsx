import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@nablis/shared/firebase';
import { useRouter } from 'expo-router';

const C = {
  navy: '#1B2E6B', yellow: '#F5C518', light: '#EEF1F8',
  grey: '#9CA3AF', dark: '#374151', border: '#E5E7EB',
  white: '#FFFFFF', bg: '#EEF1F8', red: '#DC2626',
};

export default function LoginScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

      // Check for rejected status immediately so we can show a clear message
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (snap.exists() && snap.data().status === 'rejected') {
        // Sign out and inform
        const { signOut } = await import('firebase/auth');
        await signOut(auth);
        Alert.alert(
          'Account Not Approved',
          'Your registration was not approved. Please contact the Spiritual Father for more information.'
        );
        return;
      }
      // Auth guard in _layout.tsx handles all other routing (pending → /pending, active → /home)
    } catch (error: any) {
      const msg =
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found'      ||
        error.code === 'auth/wrong-password'
          ? 'Incorrect email or password.'
          : error.message ?? 'Sign in failed. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.logo}>Nablis</Text>
        <Text style={styles.title}>Nablis Ministry</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor={C.grey}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={C.grey}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={C.white} />
            : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => router.push('/(auth)/register' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.registerBtnText}>Create New Account</Text>
        </TouchableOpacity>

        <Text style={styles.registerNote}>
          New members require approval from the Spiritual Father
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  inner:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  logo:           { fontSize: 52, marginBottom: 8 },
  title:          { fontSize: 28, fontWeight: '800', color: C.navy, marginBottom: 4 },
  subtitle:       { fontSize: 15, color: C.grey, marginBottom: 32 },
  input:          { width: '100%', maxWidth: 400, backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: C.border, color: C.dark },
  button:         { width: '100%', maxWidth: 400, backgroundColor: C.navy, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: C.white, fontSize: 16, fontWeight: '700' },
  divider:        { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 400, marginVertical: 20 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:    { marginHorizontal: 12, fontSize: 12, color: C.grey, fontWeight: '600' },
  registerBtn:    { width: '100%', maxWidth: 400, backgroundColor: C.white, borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: C.navy },
  registerBtnText:{ color: C.navy, fontSize: 15, fontWeight: '700' },
  registerNote:   { marginTop: 12, fontSize: 12, color: C.grey, textAlign: 'center' },
});
