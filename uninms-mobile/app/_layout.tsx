import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { ToastProvider } from '../src/components/Toast';
import { queryClient } from '../src/lib/queryClient';
import { useAuthStore } from '../src/stores/authStore';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { SidebarProvider } from '../src/context/SidebarContext';
import { Sidebar, SidebarToggle } from '../src/components/Sidebar';

function AuthGate() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { loadUser(); }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === 'auth';
    if (!isAuthenticated && !inAuth) router.replace('/auth/login');
    if (isAuthenticated && inAuth) router.replace('/(tabs)/home');
  }, [isAuthenticated, isLoading, segments]);

  return null;
}

function RootStack() {
  const { isDark, colors } = useTheme();
  const { isAuthenticated } = useAuthStore();
  usePushNotifications();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      {/* Hamburger toggle — floats above all tab screens */}
      <SidebarToggle visible={isAuthenticated} />
      {/* Sidebar panel + backdrop overlay */}
      <Sidebar />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <SidebarProvider>
              <RootStack />
            </SidebarProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
