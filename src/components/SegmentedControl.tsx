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

const PAD         = 4;   // padding interno del contenedor
const IND_PCT     = 0.9; // pastilla ocupa 90% del tab (deja margen visual)

export default function SegmentedControl({
  options, selectedOption, onSelect,
  accentColor = '#9B59B6',
}: Props) {
  const [containerW, setContainerW] = useState(0);
  const translateX  = useRef(new Animated.Value(0)).current;
  const selectedIdx = options.indexOf(selectedOption);

  useEffect(() => {
    if (containerW === 0) return;
    const usable     = containerW - PAD * 2;
    const tabW       = usable / options.length;
    const indicatorW = tabW * IND_PCT;
    // centro: padding + inicio del tab + (espacio sobrante / 2)
    const toValue = PAD + selectedIdx * tabW + (tabW - indicatorW) / 2;
    Animated.spring(translateX, {
      toValue,
      friction:        7,
      tension:         80,
      useNativeDriver: false,
    }).start();
  }, [selectedIdx, containerW]);

  const onLayout = (e: LayoutChangeEvent) =>
    setContainerW(e.nativeEvent.layout.width);

  const usable     = containerW > 0 ? containerW - PAD * 2 : 0;
  const tabW       = usable / options.length;
  const indicatorW = tabW * IND_PCT;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Pastilla deslizante */}
      {containerW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width:           indicatorW,
              transform:       [{ translateX }],
              backgroundColor: accentColor,
              shadowColor:     accentColor,
            },
          ]}
        />
      )}

      {options.map((option) => {
        const isActive = selectedOption === option;
        return (
          <Pressable key={option} onPress={() => onSelect(option)} style={styles.btn}>
            <Text style={[styles.txt, isActive && styles.txtActive]}>
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
    padding:           PAD,
    marginHorizontal:  15,
    marginBottom:      20,
    borderWidth:        1,
    borderColor:       '#1E2330',
    position:          'relative',
    overflow:          'hidden',
  },
  indicator: {
    position:      'absolute',
    top:            PAD,
    bottom:         PAD,
    borderRadius:   10,
    opacity:        0.85,
    shadowOpacity:  0.55,
    shadowRadius:   10,
    shadowOffset:  { width: 0, height: 0 },
    elevation:      5,
  },
  btn: {
    flex:            1,
    paddingVertical:  11,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:           1,
  },
  txt: {
    color:         'rgba(255,255,255,0.4)',
    fontWeight:    '600',
    fontSize:       14,
    letterSpacing:  0.3,
  },
  txtActive: {
    color:      '#FFF',
    fontWeight: 'bold',
  },
});
