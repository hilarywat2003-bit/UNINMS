import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated } from 'react-native';

export const SIDEBAR_WIDTH = 280;

type SidebarCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  translateX: Animated.Value;
};

const SidebarContext = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  const open = useCallback(() => {
    setIsOpen(true);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const close = useCallback(() => {
    Animated.timing(translateX, {
      toValue: -SIDEBAR_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  }, [translateX]);

  const toggle = useCallback(() => {
    isOpen ? close() : open();
  }, [isOpen, open, close]);

  return (
    <SidebarContext.Provider value={{ isOpen, open, close, toggle, translateX }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
