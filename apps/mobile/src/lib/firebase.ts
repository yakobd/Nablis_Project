// Single Firebase instance shared with @nablis/shared (and therefore useAuth).
// On native, auth comes from auth-native.native.ts with AsyncStorage persistence.
export { app, auth, db, storage } from '@nablis/shared/firebase';
