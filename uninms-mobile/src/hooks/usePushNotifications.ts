import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

// expo-notifications is intentionally NOT statically imported here.
// A static import causes DevicePushTokenAutoRegistration.fx.js to fire at
// module load time, which crashes in Expo Go since SDK 53.
// All usage goes through the dynamic import below, which is only executed
// in real dev/production builds.

/** True when running inside Expo Go */
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/**
 * Registers the device for push notifications and wires up tap-to-navigate.
 * Call this once in the root layout. No-ops silently when running in Expo Go.
 */
export function usePushNotifications() {
  const router = useRouter();
  // Store subscription refs as `any` — typed through the dynamic import
  const notificationListener = useRef<any>(null);
  const responseListener     = useRef<any>(null);

  useEffect(() => {
    if (IS_EXPO_GO) return; // expo-notifications push not supported in Expo Go

    let mounted = true;

    (async () => {
      // Dynamic import — module only loads in dev/production builds
      const Notifications = await import('expo-notifications');

      if (!mounted) return;

      // Configure how foreground notifications are displayed
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'UNINMS Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1a56db',
        });
      }

      // Request permission + register push token
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus === 'granted') {
        try {
          const { data: token } = await Notifications.getExpoPushTokenAsync({});
          const { notificationsApi } = await import('../lib/api');
          await notificationsApi.registerPushToken(token, 'expo');
        } catch {
          // token fetch / registration may fail in simulators — not fatal
        }
      }

      // Navigate if the app was opened by tapping a notification
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse) {
        const data = lastResponse.notification.request.content.data as Record<string, any>;
        navigateFromNotification(router, data);
      }

      // Foreground notification listener
      notificationListener.current =
        Notifications.addNotificationReceivedListener(() => {
          // alert/sound handled by setNotificationHandler above
        });

      // Tap listener
      responseListener.current =
        Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response.notification.request.content.data as Record<string, any>;
          navigateFromNotification(router, data);
        });
    })();

    return () => {
      mounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);
}

/**
 * Navigates to the relevant screen based on a notification data payload.
 *   { type: 'document',     id }       → /repository/:id
 *   { type: 'forum_thread', id }       → /forums/:id
 *   { type: 'assignment' | 'course' }  → courses tab
 *   { type: 'research' }               → research tab
 *   anything else                      → notifications tab
 */
export function navigateFromNotification(
  router: ReturnType<typeof useRouter>,
  data: Record<string, any>,
) {
  if (!data?.type) { router.push('/(tabs)/notifications'); return; }

  switch (data.type) {
    case 'document':
      router.push(data.id ? `/repository/${data.id}` as any : '/(tabs)/repository');
      break;
    case 'forum_thread':
    case 'forum':
      router.push(data.id ? `/forums/${data.id}` as any : '/(tabs)/forums');
      break;
    case 'assignment':
    case 'submission':
    case 'course':
      router.push('/(tabs)/courses');
      break;
    case 'research':
      router.push('/(tabs)/research');
      break;
    default:
      router.push('/(tabs)/notifications');
  }
}
