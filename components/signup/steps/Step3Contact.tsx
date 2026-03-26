// components/signup/steps/Step3Contact.tsx
// Étape 3: Email, téléphone et vérification OTP

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SignupInput } from '../SignupInput';
import { PhoneInput, formatFullPhone, validatePhone } from '@/components/PhoneInput';
import { useSignup } from '@/contexts/SignupContext';
import { phoneVerificationService } from '@/services/phone-verification.service';
import { colors, spacing, typography, borderRadius } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

const OTP_LENGTH = 6;
const COOLDOWN_SECONDS = 30;

type OtpStatus = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error';

export function Step3Contact() {
  const { formData, updateFormData, updateMultipleFields, getStepErrors } = useSignup();
  const errors = getStepErrors(3);

  const [otpStatus, setOtpStatus] = useState<OtpStatus>(formData.phoneVerified ? 'verified' : 'idle');
  const [otpCode, setOtpCode] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Vérifier si le numéro est valide pour activer le bouton "Vérifier"
  const phoneValue = { countryCode: formData.phoneCountryCode, localNumber: formData.phone };
  const phoneIsValid = !validatePhone(phoneValue);
  const fullPhone = phoneIsValid ? formatFullPhone(phoneValue) : '';

  // Démarrer le cooldown
  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Nettoyage du timer
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // Réinitialiser la vérification si le numéro change
  const handlePhoneChange = useCallback((phoneVal: { countryCode: string; localNumber: string }) => {
    const changed = phoneVal.countryCode !== formData.phoneCountryCode || phoneVal.localNumber !== formData.phone;
    updateMultipleFields({
      phoneCountryCode: phoneVal.countryCode,
      phone: phoneVal.localNumber,
    });
    if (changed && formData.phoneVerified) {
      updateFormData('phoneVerified', false);
      setOtpStatus('idle');
      setOtpCode(Array(OTP_LENGTH).fill(''));
      setOtpError(null);
    }
  }, [formData.phoneCountryCode, formData.phone, formData.phoneVerified]);

  // Envoyer le code OTP
  const handleSendOtp = async () => {
    if (!phoneIsValid || cooldown > 0) return;

    setOtpStatus('sending');
    setOtpError(null);

    const result = await phoneVerificationService.sendOtp(fullPhone);

    if (result.success) {
      setOtpStatus('sent');
      setOtpCode(Array(OTP_LENGTH).fill(''));
      startCooldown();
      // Focus la première case OTP
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } else {
      setOtpStatus('error');
      setOtpError(result.error || 'Erreur lors de l\'envoi');
    }
  };

  // Gérer la saisie OTP
  const handleOtpChange = (index: number, value: string) => {
    // N'accepter que les chiffres
    const digit = value.replace(/[^0-9]/g, '');

    if (digit.length > 1) {
      // Collage d'un code complet
      const digits = digit.slice(0, OTP_LENGTH).split('');
      const newCode = [...otpCode];
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) {
          newCode[index + i] = d;
        }
      });
      setOtpCode(newCode);
      // Focus la case après le dernier chiffre collé
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      // Vérifier auto si le code est complet
      if (newCode.every(d => d !== '')) {
        verifyCode(newCode.join(''));
      }
      return;
    }

    const newCode = [...otpCode];
    newCode[index] = digit;
    setOtpCode(newCode);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Vérifier automatiquement quand le code est complet
    if (digit && newCode.every(d => d !== '')) {
      verifyCode(newCode.join(''));
    }
  };

  // Gérer la touche retour arrière
  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otpCode[index] && index > 0) {
      const newCode = [...otpCode];
      newCode[index - 1] = '';
      setOtpCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Vérifier le code OTP
  const verifyCode = async (code: string) => {
    setOtpStatus('verifying');
    setOtpError(null);

    const result = await phoneVerificationService.verifyOtp(fullPhone, code);

    if (result.success) {
      setOtpStatus('verified');
      updateFormData('phoneVerified', true);
    } else {
      setOtpStatus('error');
      setOtpError(result.error || 'Code incorrect');
      setOtpCode(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  const showVerifyButton = phoneIsValid && otpStatus === 'idle';
  const showOtpInput = otpStatus === 'sent' || otpStatus === 'verifying' || otpStatus === 'error';
  const showVerifiedBadge = otpStatus === 'verified';

  return (
    <View style={styles.container}>
      {/* Titre et description */}
      <View style={styles.header}>
        <Text style={styles.title}>Comment vous contacter ?</Text>
        <Text style={styles.subtitle}>
          Votre email servira à vous connecter et récupérer votre compte
        </Text>
      </View>

      {/* Champs contact */}
      <View style={styles.form}>
        <SignupInput
          label="Adresse email"
          required
          icon="envelope"
          placeholder="votre.email@exemple.com"
          value={formData.email}
          onChangeText={(text) => updateFormData('email', text.toLowerCase().trim())}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
        />

        <View>
          <PhoneInput
            label="Téléphone"
            required
            value={phoneValue}
            onChangeValue={handlePhoneChange}
            error={errors.phone}
          />

          {/* Badge vérifié */}
          {showVerifiedBadge && (
            <Animated.View entering={ZoomIn.duration(300)} style={styles.verifiedBadge}>
              <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
              <Text style={styles.verifiedText}>Numéro vérifié</Text>
            </Animated.View>
          )}

          {/* Bouton Vérifier */}
          {showVerifyButton && (
            <Animated.View entering={FadeIn.duration(200)}>
              <TouchableOpacity
                style={styles.verifyButton}
                onPress={handleSendOtp}
                activeOpacity={0.7}
              >
                <IconSymbol name="paperplane.fill" size={14} color={colors.backgroundAlt} />
                <Text style={styles.verifyButtonText}>Vérifier mon numéro</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Envoi en cours */}
          {otpStatus === 'sending' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.sendingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.sendingText}>Envoi du code en cours…</Text>
            </Animated.View>
          )}

          {/* Champ OTP */}
          {showOtpInput && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.otpSection}>
              <Text style={styles.otpLabel}>
                Code envoyé au {fullPhone}
              </Text>

              <View style={styles.otpContainer}>
                {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.otpInput,
                      otpCode[index] ? styles.otpInputFilled : null,
                      otpStatus === 'error' ? styles.otpInputError : null,
                    ]}
                    value={otpCode[index]}
                    onChangeText={(value) => handleOtpChange(index, value)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? OTP_LENGTH : 1}
                    selectTextOnFocus
                    editable={otpStatus !== 'verifying'}
                  />
                ))}
              </View>

              {/* Vérification en cours */}
              {otpStatus === 'verifying' && (
                <View style={styles.verifyingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.sendingText}>Vérification…</Text>
                </View>
              )}

              {/* Erreur OTP */}
              {otpError && (
                <Animated.View entering={FadeIn.duration(200)}>
                  <Text style={styles.otpError}>{otpError}</Text>
                </Animated.View>
              )}

              {/* Renvoyer le code */}
              <TouchableOpacity
                style={[styles.resendButton, cooldown > 0 && styles.resendButtonDisabled]}
                onPress={handleSendOtp}
                disabled={cooldown > 0}
                activeOpacity={0.7}
              >
                <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}>
                  {cooldown > 0
                    ? `Renvoyer le code (${cooldown}s)`
                    : 'Renvoyer le code'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Note de confidentialité */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyText}>
          Vos informations de contact restent privées et ne seront jamais partagées
          avec d'autres utilisateurs.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: 26,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: spacing.xl,
  },
  // Bouton vérifier
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  verifyButtonText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.backgroundAlt,
  },
  // Envoi en cours
  sendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sendingText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
  },
  // Badge vérifié
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  verifiedText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.success,
  },
  // Section OTP
  otpSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  otpLabel: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  otpInput: {
    width: 46,
    height: 54,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.inputBackground,
    textAlign: 'center',
    fontSize: typography.xl,
    fontWeight: typography.bold,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundAlt,
  },
  otpInputError: {
    borderColor: colors.error,
  },
  // Vérification en cours
  verifyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  // Erreur OTP
  otpError: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  // Renvoyer
  resendButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.primary,
    textAlign: 'center',
  },
  resendTextDisabled: {
    color: colors.textTertiary,
  },
  // Note de confidentialité
  privacyNote: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.lg,
  },
  privacyText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
