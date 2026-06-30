import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Animated, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const noOutline: any = Platform.OS === 'web'
  ? { outlineWidth: 0, outlineStyle: 'none' }
  : {};

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  maxLength?: number;
  showCounter?: boolean;
  prefix?: string;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  hint?: string;
}

export function FloatInput({
  label, value, onChangeText,
  keyboardType, autoCapitalize,
  secureTextEntry, maxLength, showCounter,
  prefix, rightIcon, onRightIconPress, hint,
}: Props) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    if (!value) Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const labelTop    = anim.interpolate({ inputRange: [0, 1], outputRange: [16, -9] });
  const labelSize   = anim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const labelColor  = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['#505060', focused ? '#9B59B6' : '#808090'],
  });
  const borderColor = focused ? '#9B59B6' : '#1E2330';

  const raised = focused || !!value;

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { borderColor }]}>
        {/* Label flotante */}
        <Animated.Text
          style={[
            styles.label,
            { top: labelTop, fontSize: labelSize, color: labelColor },
            raised && styles.labelRaisedBg,
          ]}
          pointerEvents="none"
        >
          {label}
        </Animated.Text>

        <View style={styles.row}>
          {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
          <TextInput
            style={[styles.input, noOutline]}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            keyboardType={keyboardType ?? 'default'}
            autoCapitalize={autoCapitalize ?? 'sentences'}
            secureTextEntry={secureTextEntry}
            maxLength={maxLength}
            placeholder=""
            placeholderTextColor="transparent"
          />
          {rightIcon ? (
            <TouchableOpacity onPress={onRightIconPress} style={styles.rightBtn}>
              {rightIcon}
            </TouchableOpacity>
          ) : null}
          {showCounter && maxLength ? (
            <Text style={styles.counter}>{value.length}/{maxLength}</Text>
          ) : null}
        </View>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { marginBottom: 20 },
  box: {
    borderWidth:     1,
    borderRadius:    14,
    backgroundColor: '#131620',
    paddingHorizontal: 14,
    paddingTop:      18,
    paddingBottom:   10,
    position:        'relative',
  },
  label: {
    position:   'absolute',
    left:        14,
    fontWeight:  '500',
    letterSpacing: 0.3,
    zIndex:      2,
    // Fondo para que el texto tape el borde al subir
  },
  labelRaisedBg: {
    backgroundColor: '#131620',
    paddingHorizontal: 4,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    minHeight:      28,
  },
  prefix: {
    color:      '#9B59B6',
    fontSize:   16,
    fontWeight: 'bold',
    marginRight: 3,
  },
  input: {
    flex:       1,
    color:      '#FFF',
    fontSize:   15,
    paddingVertical: 0,
  },
  rightBtn: { paddingLeft: 8 },
  counter: {
    color:    '#505060',
    fontSize: 11,
    paddingLeft: 6,
  },
  hint: {
    color:         '#404050',
    fontSize:      10,
    marginTop:      5,
    letterSpacing:  0.4,
    paddingLeft:    4,
  },
});
