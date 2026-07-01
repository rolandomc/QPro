import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  LayoutChangeEvent,
  StyleSheet,
} from 'react-native';

interface Tab {
  key: string;
  label: string;
  emoji?: string;
  color?: string;
}

interface SlidingTabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  barColor?: string;
  pillColor?: string;
  textColor?: string;
  activeTextColor?: string;
}

export function SlidingTabs({
  tabs,
  activeKey,
  onChange,
  barColor   = '#202020',
  pillColor  = '#454545',
  textColor  = 'rgba(193,193,193,0.8)',
  activeTextColor = '#ffffff',
}: SlidingTabsProps) {
  const pillX     = useRef(new Animated.Value(0)).current;
  const pillW     = useRef(new Animated.Value(0)).current;
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  // Track if pill has been initialized
  const initialized = useRef(false);

  const moveTo = useCallback(
    (key: string, animate: boolean) => {
      const layout = tabLayouts.current[key];
      if (!layout) return;
      if (animate) {
        Animated.parallel([
          Animated.spring(pillX, { toValue: layout.x, useNativeDriver: false, damping: 18, stiffness: 200, mass: 0.8 }),
          Animated.spring(pillW, { toValue: layout.width, useNativeDriver: false, damping: 18, stiffness: 200, mass: 0.8 }),
        ]).start();
      } else {
        pillX.setValue(layout.x);
        pillW.setValue(layout.width);
      }
    },
    [pillX, pillW],
  );

  const handleLayout = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      tabLayouts.current[key] = { x, width };
      // Snap pill on first layout of the active tab (no animation)
      if (key === activeKey && !initialized.current) {
        initialized.current = true;
        pillX.setValue(x);
        pillW.setValue(width);
      }
    },
    [activeKey, pillX, pillW],
  );

  const handlePress = useCallback(
    (key: string) => {
      onChange(key);
      moveTo(key, true);
    },
    [onChange, moveTo],
  );

  return (
    <View style={[styles.bar, { backgroundColor: barColor }]}>
      {/* Sliding pill */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          { backgroundColor: pillColor, left: pillX, width: pillW },
        ]}
      />

      {/* Tabs */}
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const labelColor = isActive
          ? tab.color ?? activeTextColor
          : textColor;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.8}
            onLayout={(e) => handleLayout(tab.key, e)}
            onPress={() => handlePress(tab.key)}
            style={styles.tab}
          >
            {tab.emoji ? (
              <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            ) : null}
            <Text style={[styles.tabLabel, { color: labelColor }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const PILL_HEIGHT = 32;
const BAR_PADDING = 3;

const styles = StyleSheet.create({
  bar: {
    position:       'relative',
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   48,
    padding:        BAR_PADDING,
    gap:            3,
  },
  pill: {
    position:     'absolute',
    top:          BAR_PADDING,
    height:       PILL_HEIGHT,
    borderRadius: 48,
    zIndex:       0,
  },
  tab: {
    height:         PILL_HEIGHT,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical:    4,
    borderRadius:   48,
    zIndex:         1,
    gap:            5,
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabLabel: {
    fontSize:   13,
    fontWeight: '700',
  },
});
