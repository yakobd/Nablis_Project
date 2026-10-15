import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themedStyles, tc } from "../../theme";
import { useTranslation } from '@nablis/i18n';
import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

// Tab icon that springs up when its tab becomes active (filled when active).
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.iconWrap}>
      <Animated.View
        style={[
          styles.pill,
          { opacity: scale, transform: [{ scaleX: scale.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            { scale: scale.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
            { translateY: scale.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
          ],
        }}
      >
        <Ionicons
          name={(focused ? name : `${name}-outline`) as IconName}
          size={21}
          color={focused ? tc('#1B2E6B') : tc('#9CA3AF')}
        />
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  // Android draws the app behind the system navigation bar (edge-to-edge), so
  // the tab bar grows by the bottom inset to stay clear of the phone's buttons.
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: tc('#1B2E6B'),
        tabBarInactiveTintColor: tc('#9CA3AF'),
        tabBarLabelStyle: { fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: tc('#FFFFFF', 'bg'),
          borderTopColor: tc('#E5E7EB', 'line'),
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          shadowColor: '#1B2E6B',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: t('nav.appointment'),
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('nav.messages'),
          tabBarIcon: ({ focused }) => <TabIcon name="chatbubbles" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = themedStyles({
  iconWrap: { alignItems: 'center', justifyContent: 'center', width: 52, height: 30 },
  pill:     { position: 'absolute', width: 48, height: 28, borderRadius: 14, backgroundColor: '#EEF1F8' },
});
