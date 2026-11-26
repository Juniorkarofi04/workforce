import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import { DepartmentWithStaffing, UserProfile } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  dbUser: UserProfile | null;
  assignedDepartment: DepartmentWithStaffing | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<UserProfile | null>(null);
  const [assignedDepartment, setAssignedDepartment] =
    useState<DepartmentWithStaffing | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setDbUser(null);
      setAssignedDepartment(null);
      return;
    }
    try {
      setAuthError(null);
      const data = await apiFetch<{
        user: UserProfile;
        assignedDepartment: DepartmentWithStaffing | null;
      }>('/api/me');
      setDbUser(data.user);
      setAssignedDepartment(data.assignedDepartment);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setAuthError(err.message || 'Unable to verify session with server.');
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadProfile();
      } else {
        setDbUser(null);
        setAssignedDepartment(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [loadProfile]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      setFirebaseUser(result.user);
      await loadProfile();
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        setAuthError(
          'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
        );
      } else if (err?.code === 'auth/unauthorized-domain') {
        setAuthError(
          `Domain "${window.location.hostname}" is not authorized for Firebase sign-in.`
        );
      } else if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setAuthError(err?.message || 'Google Sign-In failed.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setDbUser(null);
    setAssignedDepartment(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        assignedDepartment,
        loading,
        signingIn,
        authError,
        signInWithGoogle,
        signOut,
        refreshProfile: loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
