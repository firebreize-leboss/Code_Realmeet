
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function MyCustomScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header avec bouton retour */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Écran Personnalisé</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Titre principal */}
        <Text style={styles.title}>Bienvenue sur votre écran !</Text>

        {/* Section 1 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comment ça marche ?</Text>
          <Text style={styles.text}>
            Ce fichier se trouve dans <Text style={{ fontWeight: 'bold' }}>app/my-custom-screen.tsx</Text>
          </Text>
          <Text style={styles.text}>
            Avec Expo Router, chaque fichier .tsx dans le dossier app devient automatiquement une route accessible.
          </Text>
        </View>

        {/* Cartes d'information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Points importants</Text>
          
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Nommage des fichiers</Text>
            <Text style={styles.cardText}>
              Le nom du fichier détermine l'URL. Par exemple, "my-custom-screen.tsx" est accessible via router.push('/my-custom-screen')
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>2. Dossiers dynamiques</Text>
            <Text style={styles.cardText}>
              Utilisez (tabs) pour créer des onglets, ou [id] pour des routes dynamiques.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Navigation</Text>
            <Text style={styles.cardText}>
              Utilisez useRouter() pour naviguer entre les écrans avec router.push(), router.back(), etc.
            </Text>
          </View>
        </View>

        {/* Bouton d'action */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
