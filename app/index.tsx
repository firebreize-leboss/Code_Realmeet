import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();

  console.log('[NAV_DEBUG] index.tsx render: loading=', loading, 'hasUser=', !!user, 'userId=', user?.id);

  // Afficher un écran de chargement pendant la vérification de l'authentification
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Si l'utilisateur n'est pas connecté, rediriger vers la page d'authentification
  if (!user) {
    console.log('[NAV_DEBUG] index.tsx -> Redirect to /auth/account-type (no user)');
    return <Redirect href="/auth/account-type" />;
  }

  // Sinon, rediriger vers l'application principale
  console.log('[NAV_DEBUG] index.tsx -> Redirect to /(tabs)/browse (user found)');
  return <Redirect href="/(tabs)/browse" />;
}
