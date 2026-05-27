import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { app } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  if (AsyncStorage) {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    auth = getAuth(app);
  }
} catch {
  auth = getAuth(app);
}

export { auth };
