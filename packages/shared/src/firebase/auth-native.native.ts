// React Native build of auth-native.ts (Metro picks `.native.ts` automatically;
// Next.js never sees this file). Persists the session in AsyncStorage so users
// stay signed in across app restarts.
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { app } from './config';

function createAuth(): Auth {
  try {
    // getReactNativePersistence only exists in firebase/auth's react-native build,
    // so it is missing from the default type definitions.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require('firebase/auth');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Already initialised (e.g. fast refresh) — reuse the existing instance.
    return getAuth(app);
  }
}

export const auth = createAuth();
