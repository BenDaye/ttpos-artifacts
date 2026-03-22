import { useQueries } from '@tanstack/react-query';
import axiosInstance from '../../config/axios';
import type { AppListItem } from './useAppsQuery';

interface AppListFiltersState {
  channel: string;
  platform: string;
  arch: string;
}

/**
 * useFilteredApps hook
 *
 * 当有活跃筛选条件时，对每个应用并行发起 probe 请求
 * 检查该应用是否有符合筛选条件的版本
 *
 * @param apps - 完整的应用列表 (AppListItem[])
 * @param filters - 筛选条件 { channel, platform, arch }
 * @returns { filteredApps: AppListItem[], isFiltering: boolean, hasActiveFilters: boolean }
 */
export const useFilteredApps = (
  apps: AppListItem[],
  filters: AppListFiltersState
) => {
  const hasActiveFilters = !!(
    filters.channel ||
    filters.platform ||
    filters.arch
  );

  const queries = useQueries({
    queries: hasActiveFilters
      ? apps.map((app) => ({
          queryKey: ['app-filter-probe', app.AppName, filters] as const,
          queryFn: async () => {
            const params = new URLSearchParams({
              app_name: app.AppName,
              limit: '1',
            });
            if (filters.channel) params.append('channel', filters.channel);
            if (filters.platform) params.append('platform', filters.platform);
            if (filters.arch) params.append('arch', filters.arch);

            const response = await axiosInstance.get(
              `/search?${params.toString()}`
            );
            // 如果返回有数据则表示该应用有匹配版本
            const data = response.data;
            const hasMatch = Array.isArray(data)
              ? data.length > 0
              : data?.items
                ? data.items.length > 0
                : !!data;
            return { appName: app.AppName, hasMatch };
          },
          staleTime: 30_000,
          enabled: hasActiveFilters,
        }))
      : [],
    combine: (results) => {
      const isFiltering = results.some((r) => r.isLoading);
      const matchedAppNames = new Set(
        results
          .filter((r) => r.data?.hasMatch)
          .map((r) => r.data!.appName)
      );
      return {
        filteredApps: hasActiveFilters
          ? apps.filter((app) => matchedAppNames.has(app.AppName))
          : apps,
        isFiltering,
      };
    },
  });

  return {
    ...queries,
    hasActiveFilters,
  };
};
