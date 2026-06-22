import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, OAuthProvider, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUser, createUser, getInvite } from '@/lib/db';
import type { AppUser } from '@/types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  authError: string | null;
  signInWithMicrosoft: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          let profile = await getUser(firebaseUser.uid);
          if (!profile) {
            const email = firebaseUser.email ?? '';
            const invite = email ? await getInvite(email) : null;
            if (!invite) {
              await signOut(auth);
              setAuthError(`Access denied. ${email} has not been invited to this system. Contact an administrator.`);
              setUser(null);
              setAppUser(null);
              return;
            }
            await createUser(firebaseUser.uid, {
              name: invite.name || firebaseUser.displayName || email.split('@')[0],
              email,
              role: invite.role,
            });
            profile = await getUser(firebaseUser.uid);
          }
          setUser(firebaseUser);
          setAppUser(profile);
          setAuthError(null);
        } else {
          setUser(null);
          setAppUser(null);
        }
      } catch (err) {
        const e = err as { code?: string; message?: string };
        await signOut(auth).catch(() => {});
        setUser(null);
        setAppUser(null);
        if (e.code === 'permission-denied' || e.message?.includes('insufficient permissions')) {
          setAuthError('Firestore permissions error. Have the administrator publish security rules and invite your email.');
        } else {
          setAuthError(e.message ?? 'Failed to load profile. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const signInWithMicrosoft = async () => {
    const provider = new OAuthProvider('microsoft.com');
    const tenantId = import.meta.env.VITE_MS_TENANT_ID;
    if (tenantId) provider.setCustomParameters({ tenant: tenantId });
    provider.addScope('openid');
    provider.addScope('profile');
    provider.addScope('email');
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, authError, signInWithMicrosoft, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
