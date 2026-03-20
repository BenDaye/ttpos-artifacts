import { useInfiniteQuery } from '@tanstack/react-query';
import axiosInstance from '../../config/axios';
import type { AppVersion, PaginatedResponse } from './useAppsQuery';

export const useAppVersionsQuery = (
  appName: string,
  enabled: boolean = true,
  pageSize: number = 5
) => {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['app-versions-board', appName, pageSize],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        app_name: appName,
        limit: pageSize.toString(),
        page: String(pageParam),
      });
      const response = await axiosInstance.get(`/search?${params.toString()}`);
      return response.data as PaginatedResponse<AppVersion>;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (sum, p) => sum + (p.items?.length ?? 0),
        0
      );
      if (loaded < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled,
    staleTime: 30_000,
  });

  const versions = data?.pages.flatMap((p) => p.items ?? []) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return {
    versions,
    total,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
};
