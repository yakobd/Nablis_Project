import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = {
  navy: '#1B2E6B', yellow: '#F5C518', light: '#EEF1F8',
  grey: '#9CA3AF', dark: '#374151', border: '#E5E7EB',
  white: '#FFFFFF', bg: '#F9FAFB', red: '#DC2626',
};

const FIELDS = {
  fullName:           '',
  email:              '',
  password:           '',
  confirmPassword:    '',
  phoneNumber:        '',
  countryOfResidence: '',
  cityOfResidence:    '',
  neighborhood:       '',
  parishChurch:       '',
  christianName:      '',
};

type FieldKey = keyof typeof FIELDS;

function Field({
  label, value, onChange, secureTextEntry = false,
  keyboardType = 'default', autoCapitalize = 'words',
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <TextInput
      style={styles.input}
      placeholder={label}
      placeholderTextColor={C.grey}
      value={value}
      onChangeText={onChange}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
    />
  );
}

export default function RegisterScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [form, setForm]     = useState(FIELDS);
  const [loading, setLoading] = useState(false);

  function set(key: FieldKey, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleRegister() {
    const required: [FieldKey, string][] = [
      ['fullName',           'Full Name'],
      ['email',              'Email Address'],
      ['password',           'Password'],
      ['confirmPassword',    'Confirm Password'],
      ['phoneNumber',        'Phone Number'],
      ['countryOfResidence', 'Country of Residence'],
      ['cityOfResidence',    'City of Residence'],
      ['neighborhood',       'Neighborhood / Subcity'],
      ['parishChurch',       'Parish Church'],
      ['christianName',      'Christian Name'],
    ];
    for (const [key, label] of required) {
      if (!form[key].trim()) {
        Alert.alert('Missing Field', `Please fill in: ${label}`);
        return;
      }
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth, form.email.trim().toLowerCase(), form.password
      );
      await updateProfile(cred.user, { displayName: form.fullName.trim() });

      await setDoc(doc(db, 'users', cred.user.uid), {
        email:               form.email.trim().toLowerCase(),
        displayName:         form.fullName.trim(),
        photoURL:            null,
        role:                'member',
        status:              'pending',
        phoneNumber:         form.phoneNumber.trim(),
        countryOfResidence:  form.countryOfResidence.trim(),
        cityOfResidence:     form.cityOfResidence.trim(),
        neighborhood:        form.neighborhood.trim(),
        parishChurch:        form.parishChurch.trim(),
        christianName:       form.christianName.trim(),
        createdAt:           serverTimestamp(),
      });
      // Auth guard in _layout.tsx will detect pending status and navigate to /pending
    } catch (err: any) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'This email is already registered.' :
        err.code === 'auth/invalid-email'         ? 'Please enter a valid email address.' :
        err.message ?? 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>

        <Image source={require('../../../assets/Logo-Blue.png')} style={styles.logo} />
        <Text style={styles.title}>Join Nablis Ministry</Text>
        <Text style={styles.subtitle}>
          Fill out your profile to request membership.{'\n'}
          The Spiritual Father will review your application.
        </Text>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Field label="Full Name *"        value={form.fullName}        onChange={v => set('fullName', v)} />
          <Field label="Email Address *"    value={form.email}           onChange={v => set('email', v)}    keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password *"         value={form.password}        onChange={v => set('password', v)} secureTextEntry />
          <Field label="Confirm Password *" value={form.confirmPassword} onChange={v => set('confirmPassword', v)} secureTextEntry />
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTACT &amp; LOCATION</Text>
          <Field label="Phone Number *"          value={form.phoneNumber}        onChange={v => set('phoneNumber', v)}        keyboardType="phone-pad" autoCapitalize="none" />
          <Field label="Country of Residence *"  value={form.countryOfResidence} onChange={v => set('countryOfResidence', v)} />
          <Field label="City of Residence *"     value={form.cityOfResidence}    onChange={v => set('cityOfResidence', v)}    />
          <Field label="Neighborhood / Subcity *" value={form.neighborhood}      onChange={v => set('neighborhood', v)}       />
        </View>

        {/* Church */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CHURCH INFORMATION</Text>
          <Field label="Parish Church *"                    value={form.parishChurch}  onChange={v => set('parishChurch', v)}  />
          <Field label="Christian Name (የክርስትና ስም) *"     value={form.christianName} onChange={v => set('christianName', v)} />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={C.white} />
            : <Text style={styles.buttonText}>Submit Registration</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
          <Text style={styles.loginLinkText}>
            Already have an account?{' '}
            <Text style={styles.loginLinkBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  scroll:         { flex: 1 },
  content:        { paddingHorizontal: 24, alignItems: 'center' },
  backBtn:        { alignSelf: 'flex-start', width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  logo:           { width: 90, height: 90, resizeMode: 'contain', marginBottom: 8 },
  title:          { fontSize: 24, fontWeight: '800', color: C.navy, marginBottom: 6, textAlign: 'center' },
  subtitle:       { fontSize: 13, color: C.grey, marginBottom: 28, textAlign: 'center', lineHeight: 20 },
  section:        { width: '100%', maxWidth: 420, marginBottom: 20 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: C.grey, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  input:          { backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: C.border, width: '100%', color: C.dark },
  button:         { width: '100%', maxWidth: 420, backgroundColor: C.navy, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: C.white, fontSize: 16, fontWeight: '700' },
  loginLink:      { marginTop: 20, paddingBottom: 8 },
  loginLinkText:  { color: C.grey, fontSize: 14 },
  loginLinkBold:  { color: C.navy, fontWeight: '700' },
});
