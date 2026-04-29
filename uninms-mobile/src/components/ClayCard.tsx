/**
 * ClayCard — Claymorphism-styled card for UNINMS.
 * Design spec (from UI/UX Pro Max):
 *   border-radius: 20px, border: 2px (muted), double shadow (outer elevation + soft inner via bg),
 *   smooth press animation 200ms ease-out.
 */
import React, { useRef } from 'react';
import { Animated, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Disable the press scale animation (for non-interactive cards) */
  pressable?: boolean;
  /** Override background color */
  backgroundColor?: string;
};

export function ClayCard({
  children,
  onPress,
  style,
  pressable = !!onPress,
  backgroundColor,
}: Props) {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (!pressable) return;
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const onPressOut = () => {
    if (!pressable) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const cardStyle: ViewStyle = {
    backgroundColor: backgroundColor ?? colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: isDark ? colors.border : colors.primary + '18',
    // Elevation (Android)
    elevation: 6,
    // Shadow (iOS) — outer soft shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.2 : 0.1,
    shadowRadius: 12,
    overflow: 'visible',
  };

  if (!onPress && !pressable) {
    return (
      <Animated.View style={[cardStyle, { transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.95}
        style={cardStyle}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
