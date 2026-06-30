import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, Text, View, Pressable,
  Animated, LayoutChangeEvent,
} from 'react-native';

interface Props {
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
  accentColor?: string;
}

export default function SegmentedControl({
  options, selectedOption, onSelect,
  accentColor = '#9B59B6',
}: Props) {
  const [widths, setWidths] = useState<number[]>([]);
  const [containerW, setContainerW] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(0)).current;

  const selectedIndex = options.indexOf(selectedOption);

  useEffect(() => {
    if (widths.length !== options.length || containerW === 0) return;
    const w = containerW / options.length;
    Animated.parallel([
      Animated.spring(translateX, {
        toValue:   selectedIndex * w + 4,
        friction:  7,
        tension:   80,
        useNativeDriver: false,
      }),
      Animated.spring(indicatorW, {
        toValue:   w - 8,
        friction:  7,
        tension:   80,
        useNativeDriver: false,
      }),
    ]).start();
  }, [selectedIndex, widths, containerW]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerW(w);
    // init widths array con largo de options
    setWidths(options.map(() => w / options.length));
  };

  const shadowStyle = {
    shadowColor:   accentColor,
    shadowOpacity: 0.55,
    shadowRadius:  10,
    elevation:     6,
  };

  return (
    <View
      style={styles.container}
      onLayout={onContainerLayout}
    >
      {/* Indicador deslizante */}
      {containerW > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            shadowStyle,
            {
              width:     indicatorW,
              transform: [{ translateX }],
              backgroundColor: accentColor,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {options.map((option, i) => {
        const isActive = selectedOption === option;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={styles.button}
          >
            <Text style={[styles.text, isActive && { color: '#FFF', fontWeight: 'bold' }]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    backgroundColor:  '#0D1117',
    borderRadius:     14,
    padding:           4,
    marginHorizontal:  15,
    marginBottom:      20,
    borderWidth:        1,
    borderColor:       '#1E2330',
    position:          'relative',
    overflow:          'hidden',
  },
  indicator: {
    position:     'absolute',
    top:           4,
    bottom:        4,
    borderRadius:  10,
  },
  button: {
    flex:           1,
    paddingVertical: 11,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:          1,
  },
  text: {
    color:         'rgba(255,255,255,0.4)',
    fontWeight:    '600',
    fontSize:       14,
    letterSpacing:  0.3,
  },
});
