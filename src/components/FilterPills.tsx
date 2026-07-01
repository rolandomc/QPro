import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, text } from '../theme';
import { common } from '../styles';

interface Props {
  options:  string[];
  selected: string;
  onChange: (v: string) => void;
}

export default function FilterPills({ options, selected, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
    >
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <TouchableOpacity
            key={opt}
            style={active ? common.pillActive : common.pill}
            onPress={() => onChange(opt)}
            activeOpacity={0.75}
          >
            <Text style={active ? common.pillTextActive : common.pillText}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
});
