import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
  Platform,
} from "react-native";
import { colors, borderRadius, spacing, typography, shadows } from "@/styles/commonStyles";

type ButtonVariant = "filled" | "outline" | "ghost" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  variant = "filled",
  size = "md",
  disabled = false,
  loading = false,
  children,
  style,
  textStyle,
}) => {
  const sizeStyles: Record<
    ButtonSize,
    { height: number; fontSize: number; padding: number; borderRadius: number }
  > = {
    sm: {
      height: 40,
      fontSize: typography.sm,
      padding: spacing.md,
      borderRadius: borderRadius.md,
    },
    md: {
      height: 50,
      fontSize: typography.base,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
    },
    lg: {
      height: 56,
      fontSize: typography.lg,
      padding: spacing.xl,
      borderRadius: borderRadius.lg,
    },
  };

  const getVariantStyle = () => {
    const baseStyle: ViewStyle = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    };

    if (disabled) {
      return {
        ...baseStyle,
        backgroundColor: colors.borderLight,
      };
    }

    switch (variant) {
      case "filled":
        return {
          ...baseStyle,
          backgroundColor: colors.primary,
          ...shadows.sm,
        };
      case "secondary":
        return {
          ...baseStyle,
          backgroundColor: colors.secondary,
          ...shadows.sm,
        };
      case "outline":
        return {
          ...baseStyle,
          backgroundColor: "transparent",
          borderWidth: 2,
          borderColor: colors.primary,
        };
      case "ghost":
        return {
          ...baseStyle,
          backgroundColor: "transparent",
        };
    }
  };

  const getTextColor = () => {
    if (disabled) {
      return colors.textSecondary;
    }

    switch (variant) {
      case "filled":
      case "secondary":
        return colors.textOnPrimary;
      case "outline":
        return colors.primary;
      case "ghost":
        return colors.text;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        getVariantStyle(),
        {
          height: sizeStyles[size].height,
          paddingHorizontal: sizeStyles[size].padding,
          borderRadius: sizeStyles[size].borderRadius,
          opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
        },
        style,
      ]}
      android_ripple={{
        color: colors.primary + '30',
        borderless: false,
      }}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text
          style={StyleSheet.flatten([
            {
              fontSize: sizeStyles[size].fontSize,
              color: getTextColor(),
              textAlign: "center",
              marginBottom: 0,
              fontWeight: typography.semibold,
            },
            textStyle,
          ])}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
};

export default Button;
