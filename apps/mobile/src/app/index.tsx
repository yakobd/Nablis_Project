import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { themedStyles, tc } from "../theme";

// Launch screen. The auth gate in _layout.tsx redirects from here as soon as
// the session is known.
export default function Index() {
  return (
    <View style={styles.root}>
      <Image source={require('../../assets/Logo-Blue.png')} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator color={tc("#1B2E6B")} />
    </View>
  );
}

const styles = themedStyles({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1F8', gap: 24 },
  logo: { width: 160, height: 80 },
});
