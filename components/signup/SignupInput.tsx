// components/signup/SignupInput.tsx
// Input stylé pour le wizard d'inscription

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, typography, borderRadius } from '@/styles/commonStyles';

interface SignupInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  icon?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  secureToggle?: boolean;
}

export function SignupInput({
  label,
  icon,
  error,
  helper,
  required = false,
  secureToggle = false,
  secureTextEntry,
  ...textInputProps
}: SignupInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = secureToggle ? !showPassword : secureTextEntry;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        {icon && (
          <IconSymbol
            name={icon as any}
            size={18}
            color={error ? colors.error : isFocused ? colors.primary : colors.textTertiary}
          />
        )}

        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isSecure}
          {...textInputProps}
        />

        {secureToggle && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol
              name={showPassword ? 'eye.slash.fill' : 'eye.fill'}
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  required: {
    color: colors.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.md,
    minHeight: 52,
  },
  inputContainerFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundAlt,
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  helper: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginLeft: spacing.xs,
  },
  error: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.error,
    marginLeft: spacing.xs,
  },
});
