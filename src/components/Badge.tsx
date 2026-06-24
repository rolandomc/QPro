import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  icon: string;
  title: string;
  isUnlocked: boolean;
  neonColor?: string;
}

export default function Badge({ icon, title, isUnlocked, neonColor = '#F39C12' }: Props) {
  // boxShadow calculado dinámicamente con el neonColor recibido por prop
  const neonShadow = isUnlocked
    ? { boxShadow: `0 0 10px 3px ${neonColor}CC` } // CC = ~80% opacidad en hex
    : undefined;

  return (
    <View
      style={[
        styles.container,
        isUnlocked && { borderColor: neonColor },
        isUnlocked && styles.unlocked,
        neonShadow,
      ]}
    >
      <Text style={[styles.icon, !isUnlocked && styles.lockedIcon]}>{icon}</Text>
      <Text style={[styles.title, !isUnlocked && styles.lockedText]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 90,
    height: 100,
    backgroundColor: '#15181F',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    borderWidth: 1.5,
    borderColor: '#2A2D35',
  },
  unlocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  icon: {
    fontSize: 28,
    marginBottom: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  lockedIcon: {
    opacity: 0.3,
  },
  lockedText: {
    color: '#707070',
  },
});
