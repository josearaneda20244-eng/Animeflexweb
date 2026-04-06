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

  const refreshConfig = async () => {
    await queryClient.invalidateQueries({ queryKey: ["limits-config"] });
    return refetch();
  };

  return { config, loading, refreshConfig };
}