import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../lib/firebase';
import { useAuth } from '@nablis/shared/firebase';
import { Avatar } from './Avatar';

const C = {
  navy: '#1B2E6B', yellow: '#F5C518', light: '#EEF1F8',
  grey: '#9CA3AF', dark: '#374151', border: '#E5E7EB',
  white: '#FFFFFF', bg: '#F9FAFB',
};

const MENU_ITEMS = [
  { label: 'Home',          emoji: '🏠', route: '/(tabs)/home'         },
  { label: 'Daily Prayers', emoji: '🙏', route: '/daily-prayers'       },
  { label: 'Appointments',  emoji: '📅', route: '/(tabs)/appointments' },
  { label: 'Messages',      emoji: '💬', route: '/(tabs)/messages'     },
  { label: 'Bible Study',   emoji: '📖', route: '/bible-study'         },
  { label: 'Blogs',         emoji: '✍️', route: '/blogs'               },
  { label: 'Events',        emoji: '🎉', route: '/events'              },
  { label: 'Attendance',    emoji: '✅', route: '/attendance'          },
  { label: 'Gallery',       emoji: '🖼️', route: '/gallery'             },
  { label: 'Testimonials',  emoji: '⭐', route: '/testimony'           },
  { label: 'Notifications', emoji: '🔔', route: '/notifications'       },
  { label: 'Profile',       emoji: '👤', route: '/(tabs)/profile'      },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  currentRoute?: string;
}

export function SidebarDrawer({ visible, onClose, currentRoute }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  async function handleSignOut() {
    onClose();
    try {
      const { signOut } = require('firebase/auth');
      await signOut(auth);
      router.replace('/(auth)/login' as any);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Sign out failed.');
    }
  }

  function navigate(route: string) {
    onClose();
    router.push(route as any);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Drawer panel */}
        <View style={[styles.drawer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          {/* User info header */}
          <View style={styles.userSection}>
            <Avatar
              uri={user?.photoURL}
              name={user?.displayName || user?.email}
              size={48}
              bgColor={C.navy}
              textColor={C.yellow}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.displayName || 'Member'}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email || ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Nav items */}
          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {MENU_ITEMS.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
                  onPress={() => navigate(item.route)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuEmoji}>{item.emoji}</Text>
                  <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                    {item.label}
                  </Text>
                  {isActive && <View style={styles.activeIndicator} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.divider} />

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={styles.signOutEmoji}>🚪</Text>
            <Text style={styles.signOutLabel}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Backdrop — tap to close */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, flexDirection: 'row' },
  drawer:           { width: 300, backgroundColor: C.white, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  backdrop:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  userSection:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  userInfo:         { flex: 1 },
  userName:         { fontSize: 15, fontWeight: '700', color: C.dark },
  userEmail:        { fontSize: 12, color: C.grey, marginTop: 2 },
  closeBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:     { fontSize: 14, color: C.dark, fontWeight: '700' },
  divider:          { height: 1, backgroundColor: C.border, marginVertical: 8 },
  menuScroll:       { flex: 1 },
  menuItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  menuItemActive:   { backgroundColor: C.light },
  menuEmoji:        { fontSize: 18, marginRight: 12, width: 24, textAlign: 'center' },
  menuLabel:        { flex: 1, fontSize: 15, color: C.dark, fontWeight: '500' },
  menuLabelActive:  { color: C.navy, fontWeight: '700' },
  activeIndicator:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.navy },
  signOutBtn:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8 },
  signOutEmoji:     { fontSize: 18, width: 24, textAlign: 'center' },
  signOutLabel:     { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
