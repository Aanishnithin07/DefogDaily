/**
 * Firebase, loaded lazily and only if configured.
 *
 * DefogDaily is local-first: the entire product — scans, report, training plan,
 * history — works with no backend at all. Firebase only provides optional cloud
 * sync and the AI coach. Importing it statically would put ~600kB of SDK in the
 * critical path for every visitor, including the majority who never sign in, so
 * every entry point here is an async accessor that dynamically imports the SDK
 * on first real use.
 */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isConfigured = !!firebaseConfig.apiKey;

let appPromise = null;
let authPromise = null;
let dbPromise = null;

const loadApp = () => {
  if (!isConfigured) return Promise.resolve(null);
  if (!appPromise) {
    appPromise = import("firebase/app")
      .then(({ initializeApp }) => initializeApp(firebaseConfig))
      .catch((error) => {
        console.error("Firebase initialization failed:", error);
        appPromise = null;
        return null;
      });
  }
  return appPromise;
};

export const getFirebaseApp = loadApp;

export const getAuthClient = () => {
  if (!isConfigured) return Promise.resolve(null);
  if (!authPromise) {
    authPromise = Promise.all([loadApp(), import("firebase/auth")])
      .then(([app, mod]) => (app ? { auth: mod.getAuth(app), mod } : null))
      .catch((error) => {
        console.error("Firebase auth load failed:", error);
        authPromise = null;
        return null;
      });
  }
  return authPromise;
};

export const getDb = () => {
  if (!isConfigured) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = Promise.all([loadApp(), import("firebase/firestore")])
      .then(([app, mod]) => (app ? { db: mod.getFirestore(app), mod } : null))
      .catch((error) => {
        console.error("Firestore load failed:", error);
        dbPromise = null;
        return null;
      });
  }
  return dbPromise;
};

export const signInWithGoogle = async () => {
  const client = await getAuthClient();
  if (!client) throw new Error("Firebase is not configured. Add keys to .env.local.");
  const provider = new client.mod.GoogleAuthProvider();
  return client.mod.signInWithPopup(client.auth, provider);
};

export const logout = async () => {
  const client = await getAuthClient();
  if (!client) return undefined;
  return client.mod.signOut(client.auth);
};

/** Subscribe to auth state. Returns an unsubscribe function synchronously. */
export const watchAuth = (callback) => {
  let unsubscribe = null;
  let cancelled = false;

  getAuthClient().then((client) => {
    if (!client || cancelled) {
      if (!client) callback(null);
      return;
    }
    unsubscribe = client.mod.onAuthStateChanged(client.auth, callback);
  });

  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
};
