import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  { label: 'Home',          icon: 'home-outline',             route: '/(tabs)/home'         },
  { label: 'Daily Prayers', icon: 'sunny-outline',            route: '/daily-prayers'       },
  { label: 'Appointments',  icon: 'calendar-outline',         route: '/(tabs)/appointments' },
  { label: 'Messages',      icon: 'chatbubble-outline',       route: '/(tabs)/messages'     },
  { label: 'Bible Study',   icon: 'book-outline',             route: '/bible-study'         },
  { label: 'Blogs',         icon: 'newspaper-outline',        route: '/blogs'               },
  { label: 'Events',        icon: 'balloon-outline',          route: '/events'              },
  { label: 'Attendance',    icon: 'checkmark-circle-outline', route: '/attendance'          },
  { label: 'Gallery',       icon: 'images-outline',           route: '/gallery'             },
  { label: 'Testimonials',  icon: 'star-outline',             route: '/testimony'           },
  { label: 'Notifications', icon: 'notifications-outline',    route: '/notifications'       },
  { label: 'Profile',       icon: 'person-outline',           route: '/(tabs)/profile'      },
] as const;

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
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.drawer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
            {/* User info */}
            <View style={styles.userSection}>
              <Avatar uri={user?.photoURL} name={user?.displayName || user?.email} size={48} bgColor={C.navy} textColor={C.yellow} />
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>{user?.displayName || 'Member'}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user?.email || ''}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={C.dark} />
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
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={isActive ? C.navy : C.grey}
                      style={styles.menuIcon}
                    />
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
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.signOutLabel}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer:           { position: 'absolute', left: 0, top: 0, bottom: 0, width: 300, backgroundColor: C.white, paddingHorizontal: 16 },
  userSection:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  userInfo:         { flex: 1 },
  userName:         { fontSize: 15, fontWeight: '700', color: C.dark },
  userEmail:        { fontSize: 12, color: C.grey, marginTop: 2 },
  closeBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' },
  divider:          { height: 1, backgroundColor: C.border, marginVertical: 8 },
  menuScroll:       { flex: 1 },
  menuItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  menuItemActive:   { backgroundColor: C.light },
  menuIcon:         { marginRight: 12 },
  menuLabel:        { flex: 1, fontSize: 15, color: C.dark, fontWeight: '500' },
  menuLabelActive:  { color: C.navy, fontWeight: '700' },
  activeIndicator:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.navy },
  signOutBtn:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8 },
  signOutLabel:     { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
