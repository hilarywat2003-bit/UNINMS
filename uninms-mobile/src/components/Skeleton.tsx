import { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// ── Base Skeleton ─────────────────────────────────────────────────────────────
export function Skeleton({
  width, height, borderRadius = 8, style,
}: {
  width?: number | `${number}%` | 'auto';
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width ?? '100%', height, borderRadius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

// ── Composite skeletons ───────────────────────────────────────────────────────
export function SkeletonDocCard() {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 10,
      borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton width={44} height={44} borderRadius={10} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton height={14} width="80%" />
          <Skeleton height={12} width="50%" />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Skeleton height={20} width={60} borderRadius={6} />
            <Skeleton height={20} width={80} borderRadius={6} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function SkeletonThreadCard() {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 10,
      borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8,
    }}>
      <Skeleton height={15} width="85%" />
      <Skeleton height={13} width="65%" />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
        <Skeleton height={12} width={80} />
        <Skeleton height={12} width={60} />
      </View>
    </View>
  );
}

export function SkeletonNotifItem() {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 14,
      flexDirection: 'row', gap: 12,
    }}>
      <Skeleton width={10} height={10} borderRadius={5} style={{ marginTop: 5 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton height={14} width="90%" />
        <Skeleton height={12} width="40%" />
      </View>
    </View>
  );
}

export function SkeletonStatCard() {
  const { colors } = useTheme();
  return (
    <View style={{
      flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 8,
    }}>
      <Skeleton width={32} height={32} borderRadius={16} />
      <Skeleton height={20} width="60%" />
      <Skeleton height={11} width="75%" />
    </View>
  );
}
