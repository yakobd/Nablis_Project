import { getApps, initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { initializeAuth, getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readEnvConfig(): FirebaseConfig {
  return {
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? '',
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? '',
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? '',
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             ?? process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? '',
  };
}

const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(readEnvConfig());

function createAuth(firebaseApp: FirebaseApp): Auth {
  try {
    // getReactNativePersistence is only in the RN build and absent from TS types —
    // access it at runtime via require so TypeScript doesn't reject the import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const { getReactNativePersistence } = require('firebase/auth') as any;
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Web (no AsyncStorage) or auth already initialized on hot reload
    return getAuth(firebaseApp);
  }
}

export const db: Firestore = getFirestore(app);
export const auth: Auth = createAuth(app);
export const storage: FirebaseStorage = getStorage(app);
export { app };
