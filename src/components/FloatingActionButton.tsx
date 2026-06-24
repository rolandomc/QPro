import React from 'react';
import { StyleSheet, View } from 'react-native';
import AnimatedButton from './AnimatedButton';

interface Props {
  title: string;
  onPress: () => void;
  visible: boolean;
}

export default function FloatingActionButton({ title, onPress, visible }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <AnimatedButton 
        title={title} 
        onPress={onPress} 
        isNeon 
        textStyle={{ color: '#000', fontSize: 18 }}
        style={{ paddingVertical: 15 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 100, // Asegura que flote sobre todo lo demás
  }
});