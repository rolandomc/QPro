import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  title: string;
  onPress: () => void;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  isNeon?: boolean;
  haptic?: 'none' | 'light' | 'medium' | 'heavy';
}

export default function AnimatedButton({
  title,
  onPress,
  style,
  textStyle,
  isNeon = false,
  haptic,
}: Props) {
  const handlePress = () => {
    // Si se pasa haptic explícito úsalo; si no, neon=medium, normal=none
    const level = haptic ?? (isNeon ? 'medium' : 'none');
    if (level === 'light')  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (level === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (level === 'heavy')  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        isNeon && styles.neonBtn,
        style,
        { transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}
    >
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1F26',
  },
  neonBtn: {
    backgroundColor: '#2ECC71',
    boxShadow: '0 0 10px 3px rgba(46, 204, 113, 0.8)',
  },
  text: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
