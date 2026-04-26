// lib/pendingInvite.ts
// Helpers pour persister l'invitation +1 pendant le flow d'authentification.
// Utilisé par app/invite/[token].tsx (stockage) et app/auth/login.tsx (restauration).

import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_INVITE_TOKEN_KEY = '@realmeet:pending_invite_token';

export async function setPendingInviteToken(token: string): Promise<void> {
  if (!token) return;
  await AsyncStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
}

export async function consumePendingInviteToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(PENDING_INVITE_TOKEN_KEY);
  if (token) {
    await AsyncStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  }
  return token;
}
