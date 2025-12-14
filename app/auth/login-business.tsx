// app/auth/login-business.tsx
// Page de connexion entreprise - SIRET optionnel + lien inscription

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { supabase } from '@/lib/supabase';

export default function LoginBusinessScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

 const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert('Erreur', 'Veuillez remplir tous les champs');
    return;
  }

  setLoading(true);

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) throw new Error('Identifiants incorrects');
    if (!authData.user) throw new Error('Erreur de connexion');

    // Vérifier que c'est bien un compte entreprise
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', authData.user.id)
      .single();

    if (profile?.account_type !== 'business') {
      await supabase.auth.signOut();
      Alert.alert(
        'Type de compte incorrect',
        'Ce compte est un compte particulier. Veuillez utiliser la connexion "Particulier".',
        [
          { text: 'Aller vers Particulier', onPress: () => router.replace('/auth/login-individual') },
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }

    router.replace('/(tabs)/profile');
  } catch (error: any) {
    Alert.alert('Erreur', error.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connexion Entreprise</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.welcomeSection}>
          <View style={[styles.iconContainer, { backgroundColor: colors.secondary + '20' }]}>
            <IconSymbol name="building.2.fill" size={48} color={colors.secondary} />
          </View>
          <Text style={styles.welcomeTitle}>Espace Entreprise</Text>
          <Text style={styles.welcomeSubtitle}>
            Connectez-vous à votre compte professionnel
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email professionnel</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="envelope.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="contact@entreprise.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="lock.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <IconSymbol
                  name={showPassword ? "eye.slash.fill" : "eye.fill"}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.secondary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.loginButtonText}>Se connecter</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>INFORMATIONS</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Avec un compte entreprise :</Text>
          
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: colors.secondary + '20' }]}>
              <IconSymbol name="calendar" size={24} color={colors.secondary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Événements professionnels</Text>
              <Text style={styles.featureText}>
                Organisez des événements et développez votre activité
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: colors.secondary + '20' }]}>
              <IconSymbol name="chart.bar.fill" size={24} color={colors.secondary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Analytics avancés</Text>
              <Text style={styles.featureText}>
                Suivez les performances de vos événements en temps réel
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: colors.secondary + '20' }]}>
              <IconSymbol name="person.2.fill" size={24} color={colors.secondary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Gestion des participants</Text>
              <Text style={styles.featureText}>
                Gérez facilement les inscriptions à vos activités
              </Text>
            </View>
          </View>
        </View>

        {/* Lien vers inscription */}
        <View style={styles.signupSection}>
          <Text style={styles.signupText}>Pas encore de compte entreprise ?</Text>
          <TouchableOpacity onPress={() => router.push('/auth/register-business')}>
            <Text style={[styles.signupLink, { color: colors.secondary }]}>
              Créer un compte
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.switchSection}>
          <Text style={styles.switchText}>Vous êtes un particulier ?</Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login-individual')}>
            <Text style={styles.switchLink}>Se connecter ici</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  switchSection: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 24,
  gap: 8,
},
switchText: {
  fontSize: 14,
  color: colors.textSecondary,
},
switchLink: {
  fontSize: 14,
  color: colors.primary,
  fontWeight: '600',
},
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: 20,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 1,
  },
  featuresSection: {
    gap: 16,
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  feature: {
    flexDirection: 'row',
    gap: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  signupSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingBottom: 20,
  },
  signupText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: 15,
    fontWeight: '600',
  },
});