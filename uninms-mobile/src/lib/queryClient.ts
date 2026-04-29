import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime:          1000 * 60 * 2,   // data is fresh for 2 min — no refetch on tab switch
      gcTime:             1000 * 60 * 10,  // keep unused cache for 10 min
      refetchOnWindowFocus:    false,       // don't refetch just from switching apps
      refetchOnReconnect:      true,        // do refetch when coming back online
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
