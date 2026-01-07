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
import { colors, commonStyles, borderRadius, spacing, shadows, typography } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { supabase } from '@/lib/supabase';

export default function LoginIndividualScreen() {
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

    // Vérifier le type de compte
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', authData.user.id)
      .single();

    if (profile?.account_type === 'business') {
      await supabase.auth.signOut();
      Alert.alert(
        'Type de compte incorrect',
        'Ce compte est un compte entreprise. Veuillez utiliser la connexion "Entreprise".',
        [
          { text: 'Aller vers Entreprise', onPress: () => router.replace('/auth/login-business') },
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }

    router.replace('/(tabs)/browse');
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
        <Text style={styles.headerTitle}>Connexion</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Bon retour !</Text>
          <Text style={styles.welcomeSubtitle}>
            Connectez-vous pour retrouver vos activités
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="envelope" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="votre.email@exemple.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="lock.fill" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
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
            style={styles.loginButton}
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
          <Text style={styles.dividerText}>OU</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity style={styles.socialButton}>
            <IconSymbol name="logo.apple" size={24} color={colors.text} />
            <Text style={styles.socialButtonText}>Continuer avec Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialButton}>
            <IconSymbol name="logo.google" size={24} color={colors.text} />
            <Text style={styles.socialButtonText}>Continuer avec Google</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.signupSection}>
          <Text style={styles.signupText}>Vous n'avez pas de compte RealMeet ?</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/auth/signup-individual')}>
          <Text style={styles.signupLink}>Créez un compte</Text>
        </TouchableOpacity>

        <View style={styles.switchSection}>
          <Text style={styles.switchText}>Vous êtes une entreprise ?</Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login-business')}>
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundAccent,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  welcomeSection: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -1,
  },
  welcomeSubtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.base * 1.5,
  },
  form: {
    gap: spacing.xl,
    marginBottom: spacing.xxl,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    gap: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
  },
  forgotPasswordText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.semibold,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.md,
  },
  loginButtonText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  switchSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  switchText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  switchLink: {
    fontSize: typography.sm,
    color: colors.secondary,
    fontWeight: typography.semibold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xxl,
    gap: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  socialButtons: {
    gap: spacing.md,
    marginBottom: spacing.xxxl,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  socialButtonText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.text,
  },
  signupSection: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  signupText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  signupLink: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
});