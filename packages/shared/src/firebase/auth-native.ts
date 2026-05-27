import { initializeAuth, getAuth } from 'firebase/auth';
import { app } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  // getReactNativePersistence is absent from web TS types — access via require at runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { getReactNativePersistence } = require('firebase/auth') as any;
  if (AsyncStorage && getReactNativePersistence) {
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
