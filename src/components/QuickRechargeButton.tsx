import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';

interface Props {
  amount: number;
  onPress: () => void;
}

export default function QuickRechargeButton({ amount, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}
    >
      <Text style={styles.text}>+${amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2ECC71',
    marginHorizontal: 4,
  },
  buttonPressed: {
    backgroundColor: 'rgba(46, 204, 113, 0.25)',
  },
  text: {
    color: '#2ECC71',
    fontWeight: 'bold',
    fontSize: 14,
    textShadowColor: 'rgba(46, 204, 113, 0.5)',
    textShadowRadius: 5,
  },
});
