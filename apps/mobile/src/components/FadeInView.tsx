import React, { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

interface FadeInViewProps {
  children: React.ReactNode;
  /** Delay before animating, e.g. index * 60 for staggered lists. */
  delay?: number;
  /** Starting vertical offset in px. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

// Fades and slides its children up once, when first mounted.
export function FadeInView({ children, delay = 0, offset = 12, style }: FadeInViewProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay: Math.min(delay, 400),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
