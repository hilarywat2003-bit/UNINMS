import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMsg { id: number; message: string; type: ToastType; }
interface ToastCtx { show: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastCtx>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const COLORS: Record<ToastType, string> = {
  success: '#10B981',
  error:   '#EF4444',
  warning: '#F59E0B',
  info:    '#3B82F6',
};
const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

function ToastItem({ msg, onHide }: { msg: ToastMsg; onHide: () => void }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 3 s
    const timer = setTimeout(() => dismiss(), 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,   duration: 280, useNativeDriver: true }),
    ]).start(() => onHide());
  };

  return (
    <Animated.View style={[styles.toast, { backgroundColor: COLORS[msg.type], transform: [{ translateY }], opacity }]}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{ICONS[msg.type]}</Text>
      </View>
      <Text style={styles.text} numberOfLines={3}>{msg.message}</Text>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.close}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const counter = useRef(0);
  const insets  = useSafeAreaInsets();

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current;
    setToasts(prev => [...prev.slice(-2), { id, message, type }]); // max 3 visible
  }, []);

  const hide = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={[styles.container, { top: insets.top + 10 }]} pointerEvents="box-none">
        {toasts.map(msg => (
          <ToastItem key={msg.id} msg={msg} onHide={() => hide(msg.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', left: 16, right: 16, zIndex: 9999,
  },
  toast: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 8, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  icon:  { color: '#fff', fontSize: 13, fontWeight: '800' },
  text:  { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 19 },
  close: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },
});
