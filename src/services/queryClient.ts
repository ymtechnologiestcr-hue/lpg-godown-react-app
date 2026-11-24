import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 0,
      refetchOnWindowFocus: false,
    },
  },
});

export const fetchCachedQuery = <T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  staleTime: number,
  forceRefresh = false,
): Promise<T> =>
  queryClient.fetchQuery({
    queryKey,
    queryFn,
    staleTime: forceRefresh ? 0 : staleTime,
  });

export const clearAppQueryCache = () => queryClient.clear();
