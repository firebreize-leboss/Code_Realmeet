// app/auth/signup-wizard.tsx
// Écran principal du wizard d'inscription multi-étapes

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { SignupProvider, useSignup, TOTAL_STEPS } from '@/contexts/SignupContext';
import {
  SignupHeader,
  SignupFooter,
  Step1PhotoName,
  Step2BirthDate,
  Step3Contact,
  Step4City,
  Step5Intention,
  Step6Bio,
  Step7InterestsPassword,
  StepReview,
  StepSuccess,
} from '@/components/signup';
import { colors } from '@/styles/commonStyles';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { storageService } from '@/services/storage.service';

// Mode du wizard
type WizardMode = 'steps' | 'review' | 'success';

function SignupWizardContent() {
  const {
    formData,
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    isStepValid,
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    isLoading: contextLoading,
  } = useSignup();

  const [mode, setMode] = useState<WizardMode>('steps');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Gérer le bouton retour Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, [currentStep, mode]);

  // Proposer de reprendre le brouillon au montage
  useEffect(() => {
    if (hasDraft && !contextLoading) {
      Alert.alert(
        'Reprendre votre inscription ?',
        'Vous aviez commencé à créer votre compte. Voulez-vous reprendre où vous en étiez ?',
        [
          {
            text: 'Recommencer',
            style: 'destructive',
            onPress: clearDraft,
          },
          {
            text: 'Reprendre',
            onPress: loadDraft,
          },
        ]
      );
    }
  }, [hasDraft, contextLoading]);

  // Sauvegarder le brouillon quand on quitte une étape
  const handleSaveDraft = useCallback(() => {
    if (currentStep > 1 || formData.firstName || formData.lastName) {
      saveDraft();
    }
  }, [currentStep, formData, saveDraft]);

  const handleBack = () => {
    if (mode === 'success') {
      return; // On ne peut pas revenir depuis success
    }

    if (mode === 'review') {
      setMode('steps');
      goToStep(TOTAL_STEPS);
      return;
    }

    if (currentStep === 1) {
      // Proposer de sauvegarder avant de quitter
      if (formData.firstName || formData.lastName || formData.email) {
        Alert.alert(
          'Sauvegarder et quitter ?',
          'Votre progression sera sauvegardée pour plus tard.',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Quitter sans sauvegarder',
              style: 'destructive',
              onPress: () => {
                clearDraft();
                router.back();
              },
            },
            {
              text: 'Sauvegarder',
              onPress: () => {
                saveDraft();
                router.back();
              },
            },
          ]
        );
      } else {
        router.back();
      }
    } else {
      prevStep();
    }
  };

  const handleClose = () => {
    if (mode === 'success') {
      router.replace('/(tabs)/browse');
      return;
    }

    Alert.alert(
      'Quitter l\'inscription ?',
      'Votre progression sera sauvegardée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Sauvegarder et quitter',
          onPress: () => {
            saveDraft();
            router.back();
          },
        },
      ]
    );
  };

  const handleNext = () => {
    if (!isStepValid(currentStep)) {
      return;
    }

    handleSaveDraft();

    if (currentStep === TOTAL_STEPS) {
      setMode('review');
    } else {
      nextStep();
    }
  };

  const handleEditStep = (step: number) => {
    setMode('steps');
    goToStep(step);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Vérifier la disponibilité du username
      const username = `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`;
      const isAvailable = await userService.isUsernameAvailable(username);

      if (!isAvailable) {
        Alert.alert('Erreur', 'Ce nom d\'utilisateur existe déjà. Essayez avec un nom différent.');
        setIsSubmitting(false);
        return;
      }

      // Créer le compte
      const accountResult = await authService.registerUser({
        email: formData.email,
        password: formData.password,
        username,
        full_name: `${formData.firstName} ${formData.lastName}`,
        avatar_url: null,
        city: formData.city,
        date_of_birth: formData.birthDate,
        phone: formData.phone || undefined,
      });

      if (!accountResult.success) {
        Alert.alert('Erreur', accountResult.error || 'Erreur lors de la création du compte');
        setIsSubmitting(false);
        return;
      }

      const userId = accountResult.user!.id;

      // Upload de l'avatar si présent
      let avatarUrl = null;
      if (formData.profileImage) {
        const uploadResult = await storageService.uploadAvatar(formData.profileImage, userId);
        if (uploadResult.success) {
          avatarUrl = uploadResult.url;
        }
      }

      // Mettre à jour le profil avec les infos supplémentaires
      await userService.updateProfile(userId, {
        avatar_url: avatarUrl,
        bio: formData.bio || null,
        interests: formData.interests.length > 0 ? formData.interests : null,
        intention: formData.intention,
      });

      // Supprimer le brouillon
      await clearDraft();

      // Afficher l'écran de succès
      setMode('success');

    } catch (error: any) {
      console.error('Erreur inscription:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    router.replace('/(tabs)/browse');
  };

  // Rendu du contenu selon le mode
  const renderContent = () => {
    if (mode === 'success') {
      return <StepSuccess />;
    }

    if (mode === 'review') {
      return <StepReview onEditStep={handleEditStep} />;
    }

    switch (currentStep) {
      case 1:
        return <Step1PhotoName />;
      case 2:
        return <Step2BirthDate />;
      case 3:
        return <Step3Contact />;
      case 4:
        return <Step4City />;
      case 5:
        return <Step5Intention />;
      case 6:
        return <Step6Bio />;
      case 7:
        return <Step7InterestsPassword />;
      default:
        return <Step1PhotoName />;
    }
  };

  // Labels des boutons selon l'étape
  const getFooterConfig = () => {
    if (mode === 'success') {
      return {
        primaryLabel: 'Commencer à explorer',
        onPrimary: handleFinish,
        primaryDisabled: false,
      };
    }

    if (mode === 'review') {
      return {
        primaryLabel: 'Créer mon compte',
        onPrimary: handleSubmit,
        primaryDisabled: isSubmitting,
        primaryLoading: isSubmitting,
        secondaryLabel: 'Retour',
        onSecondary: () => {
          setMode('steps');
          goToStep(TOTAL_STEPS);
        },
        hint: 'En créant un compte, vous acceptez nos Conditions d\'utilisation',
      };
    }

    const isValid = isStepValid(currentStep);
    const isLastStep = currentStep === TOTAL_STEPS;

    return {
      primaryLabel: isLastStep ? 'Vérifier mes informations' : 'Continuer',
      onPrimary: handleNext,
      primaryDisabled: !isValid,
      secondaryLabel: currentStep === 6 ? 'Passer cette étape' : undefined,
      onSecondary: currentStep === 6 ? handleNext : undefined,
    };
  };

  const footerConfig = getFooterConfig();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header avec progression */}
        {mode !== 'success' && (
          <SignupHeader
            currentStep={mode === 'review' ? TOTAL_STEPS : currentStep}
            totalSteps={TOTAL_STEPS}
            onBack={handleBack}
            onClose={handleClose}
            showBack={mode !== 'success'}
          />
        )}

        {/* Contenu scrollable avec gestion du clavier */}
        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          bottomOffset={100}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            key={mode === 'steps' ? `step-${currentStep}` : mode}
            entering={FadeIn.duration(200)}
            style={styles.stepContainer}
          >
            {renderContent()}
          </Animated.View>
        </KeyboardAwareScrollView>

        {/* Footer avec CTAs */}
        <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
          <SignupFooter {...footerConfig} />
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

export default function SignupWizardScreen() {
  return (
    <SignupProvider>
      <SignupWizardContent />
    </SignupProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
  },
  footerSafeArea: {
    backgroundColor: colors.backgroundAlt,
  },
});
