import { createContext, useContext, useEffect, useState } from "react";
import { isConfigured, logout, signInWithGoogle, watchAuth } from "../lib/firebase";

const AuthContext = createContext({
  currentUser: null,
  signInWithGoogle,
  logout,
  isConfigured: false,
});

/**
 * Auth is entirely optional here. Children render immediately rather than
 * waiting on Firebase, because a signed-out visitor should never see a loading
 * screen for a feature they are not using.
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (!isConfigured) return undefined;
    return watchAuth(setCurrentUser);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, signInWithGoogle, logout, isConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
