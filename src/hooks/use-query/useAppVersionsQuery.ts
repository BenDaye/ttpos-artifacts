import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../config/axios";
import type { AppVersion, PaginatedResponse } from "./useAppsQuery";

export const useAppVersionsQuery = (
  appName: string,
  enabled: boolean = true,
  limit: number = 5
) => {
  const { data, isLoading, isError } = useQuery<PaginatedResponse<AppVersion>>({
    queryKey: ["app-versions-board", appName, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        app_name: appName,
        limit: limit.toString(),
        page: "1",
      });
      const response = await axiosInstance.get(`/search?${params.toString()}`);
      return response.data;
    },
    enabled,
    staleTime: 30_000,
  });

  return {
    versions: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError,
  };
};
