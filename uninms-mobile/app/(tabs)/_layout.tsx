import { Tabs } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function TabLayout() {
  const { user } = useAuthStore();
  const role = user?.role ?? 'student';

  const isStudent = role === 'student';

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="courses"  options={{ href: isStudent ? null : undefined }} />
      <Tabs.Screen name="research" options={{ href: isStudent ? null : undefined }} />
      <Tabs.Screen name="repository" />
      <Tabs.Screen name="forums" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="profile"       options={{ href: null }} />
      <Tabs.Screen name="logout"        options={{ href: null }} />
      <Tabs.Screen name="repository/[id]" options={{ href: null }} />
      <Tabs.Screen name="forums/[id]"     options={{ href: null }} />
    </Tabs>
  );
}
