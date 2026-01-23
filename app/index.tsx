import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();

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
    return <Redirect href="/auth/account-type" />;
  }

  // Sinon, rediriger vers l'application principale
  return <Redirect href="/(tabs)/browse" />;
}
