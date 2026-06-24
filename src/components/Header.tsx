import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function Header() {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>
        <Text style={styles.neonTextGreen}>STATZ</Text> Quinielas ▾
      </Text>
      <Pressable
        style={styles.balanceButton}
        onPress={() => router.push('/wallet')}
      >
        <Text style={styles.balanceText}>$1,250.00</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  neonTextGreen: {
    color: '#2ECC71',
    fontWeight: 'bold',
    textShadowColor: 'rgba(46, 204, 113, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  balanceButton: {
    backgroundColor: '#1C1F26',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2ECC71',
    boxShadow: '0 0 5px 2px rgba(46, 204, 113, 0.4)',
  },
  balanceText: {
    color: '#2ECC71',
    fontWeight: 'bold',
  },
});
