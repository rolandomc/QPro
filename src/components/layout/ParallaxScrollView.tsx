import React, { ReactNode, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { colors } from '../../theme/colors';

interface ParallaxScrollViewProps {
  headerContent: ReactNode;  // contenido del header con efecto parallax
  headerHeight?: number;     // altura del header (default 220)
  children: ReactNode;
}

export default function ParallaxScrollView({
  headerContent,
  headerHeight = 220,
  children,
}: ParallaxScrollViewProps) {
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTranslate = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight / 2],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  return (
    <View style={styles.container}>
      {/* Header con efecto parallax */}
      <Animated.View
        style={[
          styles.header,
          { height: headerHeight, transform: [{ translateY: headerTranslate }] },
        ]}
      >
        {headerContent}
      </Animated.View>

      {/* Contenido scrolleable */}
      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight }}
      >
        <View style={styles.content}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: colors.card,
    zIndex: 1,
  },
  content: {
    padding: 16,
    backgroundColor: colors.background,
    minHeight: 400,
  },
});
