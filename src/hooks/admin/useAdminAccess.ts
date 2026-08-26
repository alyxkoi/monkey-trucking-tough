import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isAuthorizedRole } from "@/lib/admin/adminAccess";

export const useAdminAccess = (userId?: string) => {
  const query = useQuery({
    queryKey: ["admin", "access", userId],
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.role).filter(isAuthorizedRole);
    },
  });

  return {
    ...query,
    authorized: !!userId && (query.data?.length ?? 0) > 0,
    roles: query.data ?? [],
  };
};
