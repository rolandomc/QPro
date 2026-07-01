import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, radii, text } from '../theme';

interface Props {
  icon: string;
  title: string;
  isUnlocked: boolean;
  neonColor?: string;
}

export default function Badge({ icon, title, isUnlocked, neonColor = colors.warning }: Props) {
  const neonShadow = isUnlocked
    ? { boxShadow: `0 0 10px 3px ${neonColor}CC` }
    : undefined;

  return (
    <View
      style={[
        s.container,
        isUnlocked && { borderColor: neonColor },
        isUnlocked && s.unlocked,
        neonShadow,
      ]}
    >
      <Text style={[s.icon, !isUnlocked && s.lockedIcon]}>{icon}</Text>
      <Text style={[text.caption, { fontWeight: 'bold', textAlign: 'center', color: isUnlocked ? colors.text : colors.textFaint }]}>
        {title}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: 90,
    height: 100,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  unlocked: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  icon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  lockedIcon: {
    opacity: 0.3,
  },
});
