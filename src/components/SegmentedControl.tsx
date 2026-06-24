import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

interface Props {
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
}

export default function SegmentedControl({ options, selectedOption, onSelect }: Props) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isActive = selectedOption === option;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.button, isActive && styles.activeButton]}
          >
            <Text style={[styles.text, isActive && styles.activeText]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#15181F',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2D35',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#1C1F26',
    shadowColor: '#2ECC71',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.5)',
  },
  text: { color: '#A0A0A0', fontWeight: '600', fontSize: 14 },
  activeText: { color: '#2ECC71', fontWeight: 'bold' },
});