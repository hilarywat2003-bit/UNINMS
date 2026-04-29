import { Animated, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { useAuthStore } from '../stores/authStore';
import { SIDEBAR_WIDTH, useSidebar } from '../context/SidebarContext';

type NavItem = {
  label: string;
  route: string;
  roles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',          route: '/(tabs)/home' },
  { label: 'Courses',       route: '/(tabs)/courses',       roles: ['student', 'lecturer'] },
  { label: 'Research',      route: '/(tabs)/research',      roles: ['lecturer', 'researcher'] },
  { label: 'Documents',     route: '/(tabs)/repository' },
  { label: 'Forums',        route: '/(tabs)/forums' },
  { label: 'Notifications', route: '/(tabs)/notifications' },
  { label: 'Search',        route: '/(tabs)/search' },
];

export function Sidebar() {
  const { colors, isDark } = useTheme();
  const { translateX, isOpen, close } = useSidebar();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const role = user?.role ?? 'student';

  const visibleItems = NAV_ITEMS.filter(
    item => !item.roles || item.roles.includes(role)
  );

  const navigate = (route: string) => {
    close();
    setTimeout(() => router.push(route as any), 220);
  };

  const handleLogout = () => {
    close();
    setTimeout(() => logout(), 220);
  };

  const isActive = (route: string) => pathname.startsWith(route.replace('/(tabs)', ''));

  if (!isOpen) return null;

  return (
    <View style={{
      position: 'absolute', inset: 0, zIndex: 500,
      flexDirection: 'row',
    }}>
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={close}
      />

      {/* Panel */}
      <Animated.View style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: SIDEBAR_WIDTH,
        backgroundColor: colors.surface,
        transform: [{ translateX }],
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 16,
      }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* App brand */}
          <View style={{
            paddingTop: insets.top + 24,
            paddingHorizontal: 28,
            paddingBottom: 24,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Text style={{
              fontSize: 22, fontWeight: '900', color: colors.primary,
              letterSpacing: -0.5,
            }}>
              UNINMS
            </Text>
            <Text style={{
              fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 12,
            }}>
              {user?.name ?? 'User'}
            </Text>
            <Text style={{
              fontSize: 12, color: colors.textMuted, marginTop: 3,
              textTransform: 'capitalize',
            }}>
              {role}
            </Text>
          </View>

          {/* Navigation */}
          <View style={{ paddingTop: 12, paddingHorizontal: 20 }}>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: colors.textMuted,
              letterSpacing: 1.5, textTransform: 'uppercase',
              paddingHorizontal: 8, paddingTop: 12, paddingBottom: 6,
            }}>
              Navigation
            </Text>

            {visibleItems.map(item => {
              const active = isActive(item.route);
              return (
                <TouchableOpacity
                  key={item.route}
                  onPress={() => navigate(item.route)}
                  style={{
                    paddingVertical: 13,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    marginBottom: 2,
                    backgroundColor: active ? colors.primaryLight : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: active ? '700' : '400',
                    color: active ? colors.primary : colors.text,
                  }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Divider */}
          <View style={{
            marginHorizontal: 20, marginVertical: 12,
            height: 1, backgroundColor: colors.border,
          }} />

          {/* Account */}
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: colors.textMuted,
              letterSpacing: 1.5, textTransform: 'uppercase',
              paddingHorizontal: 8, paddingBottom: 6,
            }}>
              Account
            </Text>

            <TouchableOpacity
              onPress={() => navigate('/(tabs)/profile')}
              style={{
                paddingVertical: 13, paddingHorizontal: 8,
                borderRadius: 8, marginBottom: 2,
                backgroundColor: isActive('/(tabs)/profile') ? colors.primaryLight : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 15,
                fontWeight: isActive('/(tabs)/profile') ? '700' : '400',
                color: isActive('/(tabs)/profile') ? colors.primary : colors.text,
              }}>
                Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              style={{ paddingVertical: 13, paddingHorizontal: 8, borderRadius: 8 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '400', color: colors.error }}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/** Floating hamburger button — rendered above all screens in the root layout */
export function SidebarToggle({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  const { toggle, isOpen } = useSidebar();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <TouchableOpacity
      onPress={toggle}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        position: 'absolute',
        top: insets.top + 12,
        left: 16,
        zIndex: 400,
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Hamburger or X */}
      <View style={{ gap: 5 }}>
        <View style={{
          width: isOpen ? 18 : 20, height: 2, borderRadius: 1,
          backgroundColor: '#fff',
          transform: isOpen ? [{ rotate: '45deg' }, { translateY: 7 }] : [],
        }} />
        {!isOpen && (
          <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: '#fff' }} />
        )}
        <View style={{
          width: isOpen ? 18 : 20, height: 2, borderRadius: 1,
          backgroundColor: '#fff',
          transform: isOpen ? [{ rotate: '-45deg' }, { translateY: -7 }] : [],
        }} />
      </View>
    </TouchableOpacity>
  );
}
