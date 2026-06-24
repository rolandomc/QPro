import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';

export default function ProfileOption({ title, icon }: any) {
  return (
    <Pressable
      style={({ pressed }) => [styles.optionBtn, pressed && styles.optionBtnPressed]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.arrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#15181F',
    padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2A2D35',
  },
  optionBtnPressed: {
    backgroundColor: '#1C1F26',
    opacity: 0.8,
  },
  icon: { fontSize: 20, marginRight: 15 },
  title: { color: '#FFF', fontSize: 16, flex: 1 },
  arrow: { color: '#A0A0A0', fontSize: 18 },
});
