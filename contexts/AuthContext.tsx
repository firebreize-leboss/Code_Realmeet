import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { User } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier la session au démarrage
    checkUser();

    // Écouter les changements d'auth
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH_DEBUG] onAuthStateChange event:', event, 'hasSession:', !!session, 'userId:', session?.user?.id);
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
        } else {
          console.log('[AUTH_DEBUG] No session -> clearing user & profile');
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    try {
      console.log('[AUTH_DEBUG] checkUser() called');
      const currentUser = await authService.getCurrentUser();
      console.log('[AUTH_DEBUG] checkUser result:', currentUser ? `userId=${currentUser.id}` : 'null');
      if (currentUser) {
        setUser(currentUser);
        await loadProfile(currentUser.id);
      }
    } catch (error) {
      console.error('[AUTH_DEBUG] checkUser error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(userId: string) {
    try {
      console.log('[AUTH_DEBUG] loadProfile() for userId:', userId);
      const profileData = await userService.getProfile(userId);
      console.log('[AUTH_DEBUG] loadProfile result: account_type=', profileData?.account_type, 'username=', profileData?.username);
      setProfile(profileData);
    } catch (error) {
      console.error('[AUTH_DEBUG] loadProfile error:', error);
    }
  }

  async function signOut() {
    console.log('[AUTH_DEBUG] signOut() called');
    await authService.logoutUser();
    console.log('[AUTH_DEBUG] signOut() done, clearing user & profile');
    setUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) {
      await loadProfile(user.id);
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
