import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radii, text } from '../theme';
import { common } from '../styles';

interface Props {
  label:     string;
  onPress:   () => void;
  variant?:  'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  style?:    ViewStyle;
}

export default function AnimatedButton({
  label, onPress, variant = 'primary', disabled = false, style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const baseStyle =
    variant === 'outline' ? common.btnOutline
    : variant === 'ghost'   ? common.btnGhost
    : common.btnPrimary;

  const labelStyle =
    variant === 'outline' ? common.btnOutlineText
    : variant === 'ghost'   ? common.btnGhostText
    : common.btnPrimaryText;

  return (
    <TouchableWithoutFeedback
      onPress={disabled ? undefined : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View
        style={[
          baseStyle,
          disabled && common.btnDisabled,
          { transform: [{ scale }] },
          style,
        ]}
      >
        <Text style={labelStyle}>{label}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
