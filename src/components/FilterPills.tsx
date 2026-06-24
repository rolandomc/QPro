import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, Pressable } from 'react-native';

const CATEGORIAS = ['Todos', 'Mundial 2026', 'Champions', 'Liga MX', 'Premier'];

export default function FilterPills() {
  const [active, setActive] = useState('Todos');

  return (
    <FlatList
      horizontal
      data={CATEGORIAS}
      keyExtractor={(item) => item}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      renderItem={({ item: cat }) => (
        <Pressable
          onPress={() => setActive(cat)}
          style={[styles.pill, active === cat && styles.pillActive]}
        >
          <Text style={[styles.text, active === cat && styles.textActive]}>{cat}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 15, paddingVertical: 10, gap: 10, marginBottom: 10 },
  pill: {
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35',
  },
  pillActive: {
    backgroundColor: 'rgba(46, 204, 113, 0.1)', borderColor: '#2ECC71',
  },
  text: { color: '#A0A0A0', fontSize: 13, fontWeight: '600' },
  textActive: { color: '#2ECC71', fontWeight: 'bold' },
});
