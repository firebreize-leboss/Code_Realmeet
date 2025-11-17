import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const supabaseUrl = 'https://nccjibufpzttcnqxgvhs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jY2ppYnVmcHp0dGNucXhndmhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MDI1MjQsImV4cCI6MjA3ODk3ODUyNH0.dF5Qt5igH-wnhie_eq5ymTWFVRPdMR6vkWziBcEPc54';

// Création du client Supabase avec AsyncStorage pour la persistance
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types pour TypeScript
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          city: string | null;
          date_of_birth: string | null;
          phone: string | null;
          interests: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          city?: string | null;
          date_of_birth?: string | null;
          phone?: string | null;
          interests?: string[] | null;
        };
        Update: {
          username?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          city?: string | null;
          date_of_birth?: string | null;
          phone?: string | null;
          interests?: string[] | null;
        };
      };
    };
  };
};