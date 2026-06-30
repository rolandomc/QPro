import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Animated } from 'react-native';

interface Props {
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
  accentColor?: string;
}

const IND_MARGIN = 6; // margen a cada lado de la pastilla dentro del tab

export default function SegmentedControl({
  options, selectedOption, onSelect,
  accentColor = '#9B59B6',
}: Props) {
  // Guardamos x y width de cada tab medido con onLayout
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);
  const translateX = useRef(new Animated.Value(0)).current;
  const indWidth   = useRef(new Animated.Value(0)).current;
  const selectedIdx = options.indexOf(selectedOption);

  useEffect(() => {
    const layout = tabLayouts[selectedIdx];
    if (!layout) return;
    const targetX = layout.x + IND_MARGIN;
    const targetW = layout.width - IND_MARGIN * 2;
    Animated.parallel([
      Animated.spring(translateX, { toValue: targetX, friction: 7, tension: 80, useNativeDriver: false }),
      Animated.spring(indWidth,   { toValue: targetW, friction: 7, tension: 80, useNativeDriver: false }),
    ]).start();
  }, [selectedIdx, tabLayouts]);

  return (
    <View style={styles.container}>
      {/* Pastilla deslizante */}
      {tabLayouts.length === options.length && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: indWidth, transform: [{ translateX }], backgroundColor: accentColor, shadowColor: accentColor },
          ]}
        />
      )}

      {options.map((option, i) => {
        const isActive = selectedOption === option;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={styles.btn}
            onLayout={e => {
              const { x, width } = e.nativeEvent.layout;
              setTabLayouts(prev => {
                const next = [...prev];
                next[i] = { x, width };
                return next;
              });
            }}
          >
            <Text style={[styles.txt, isActive && styles.txtActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#0D1117',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E2330',
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 4, bottom: 4,
    borderRadius: 10,
    opacity: 0.9,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  btn: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  txt: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 14, letterSpacing: 0.3 },
  txtActive: { color: '#FFF', fontWeight: 'bold' },
});
