import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

interface LimitsConfig {
  dailyLimit: number;
  dailyLimitEnabled: boolean;
  limitMessage: string;
  megafanMessage: string;
}

export function useLimitsConfig() {
  const queryClient = useQueryClient();

  const { data: config = {
    dailyLimit: 5,
    dailyLimitEnabled: true,
    limitMessage: "Has alcanzado tu límite diario de episodios gratuitos.",
    megafanMessage: "¡Hazte MegaFan y disfruta sin límites!",
  }, isLoading: loading, refetch } = useQuery({
    queryKey: ["limits-config"],
    queryFn: () => apiClient.get<LimitsConfig>("/config/limits"),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  const refreshConfig = async (): Promise<void> => {
    try {
      // Clear localStorage cache to force fresh data
      localStorage.removeItem('af_limits_config');
      // Mark cache as invalidated for synchronous functions
      localStorage.setItem('af_limits_config_invalidated', 'true');

      await queryClient.invalidateQueries({ queryKey: ["limits-config"] });
      await refetch();
    } catch (error) {
      console.error('Error refreshing limits config:', error);
      // Revert the invalidation mark on error
      localStorage.removeItem('af_limits_config_invalidated');
      throw error;
    }
  };

  return { config, loading, refreshConfig };
}