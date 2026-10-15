import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../lib/firebase';
import { useAuth } from '@nablis/shared/firebase';
import { Avatar } from './Avatar';
import { themedStyles, themedColors } from "../theme";
import { useTranslation } from '@nablis/i18n';
import { Ionicons } from '@expo/vector-icons';

const L = {
  navy: '#1B2E6B', yellow: '#F5C518', light: '#EEF1F8',
  grey: '#9CA3AF', dark: '#374151', border: '#E5E7EB',
  white: '#FFFFFF', bg: '#F9FAFB',
};
const C = themedColors(L);

const MENU_ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: 'home',           icon: 'home-outline',             route: '/(tabs)/home' },
  { label: 'announcements',  icon: 'megaphone-outline',        route: '/announcements' },
  { label: 'myPass',         icon: 'qr-code-outline',          route: '/announcements/pass' },
  { label: 'dailyPrayers',   icon: 'heart-outline',            route: '/daily-prayers' },
  { label: 'appointment',    icon: 'calendar-outline',         route: '/(tabs)/appointments' },
  { label: 'messages',       icon: 'chatbubbles-outline',      route: '/(tabs)/messages' },
  { label: 'bibleStudy',     icon: 'book-outline',             route: '/bible-study' },
  { label: 'readingPlan',    icon: 'reader-outline',           route: '/reading-plan' },
  { label: 'challenges',     icon: 'trophy-outline',           route: '/challenges' },
  { label: 'blogs',          icon: 'create-outline',           route: '/blogs' },
  { label: 'events',         icon: 'calendar-number-outline',  route: '/events' },
  { label: 'attendance',     icon: 'checkmark-done-outline',   route: '/attendance' },
  { label: 'gallery',        icon: 'images-outline',           route: '/gallery' },
  { label: 'testimonials',   icon: 'star-outline',             route: '/testimony' },
  { label: 'notifications',  icon: 'notifications-outline',    route: '/notifications' },
  { label: 'profile',        icon: 'person-outline',           route: '/(tabs)/profile' },
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
  const { t } = useTranslation();

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
              <Ionicons name="close" size={18} color={C.dark} />
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
                  <Ionicons name={item.icon} size={20} color={isActive ? C.navy : C.grey} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                    {t(`nav.${item.label}`)}
                  </Text>
                  {isActive && <View style={styles.activeIndicator} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.divider} />

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" style={styles.menuIcon} />
            <Text style={styles.signOutLabel}>{t('mobile.signOut')}</Text>
          </TouchableOpacity>
        </View>

        {/* Backdrop — tap to close */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  container:        { flex: 1, flexDirection: 'row' },
  drawer:           { width: 300, backgroundColor: L.white, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  backdrop:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  userSection:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  userInfo:         { flex: 1 },
  userName:         { fontSize: 15, fontWeight: '700', color: L.dark },
  userEmail:        { fontSize: 12, color: L.grey, marginTop: 2 },
  closeBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: L.light, alignItems: 'center', justifyContent: 'center' },
  divider:          { height: 1, backgroundColor: L.border, marginVertical: 8 },
  menuScroll:       { flex: 1 },
  menuItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  menuItemActive:   { backgroundColor: L.light },
  menuIcon:         { marginRight: 12, width: 24, textAlign: 'center' },
  menuLabel:        { flex: 1, fontSize: 15, color: L.dark, fontWeight: '500' },
  menuLabelActive:  { color: L.navy, fontWeight: '700' },
  activeIndicator:  { width: 6, height: 6, borderRadius: 3, backgroundColor: L.navy },
  signOutBtn:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  signOutLabel:     { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
