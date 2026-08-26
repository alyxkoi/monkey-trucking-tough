import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Driver, Material, Settings } from "@/lib/admin/calc";

export const useSettings = () =>
  useQuery({
    queryKey: ["admin", "settings"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<Settings> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as unknown as Settings;
    },
  });

export const useMaterials = (activeOnly = true) =>
  useQuery({
    queryKey: ["admin", "materials"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase.from("materials").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    select: (rows) => activeOnly ? rows.filter((row) => row.is_active) : rows,
  });

export const useDrivers = (activeOnly = true) =>
  useQuery({
    queryKey: ["admin", "drivers"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<Driver[]> => {
      const { data, error } = await supabase.from("drivers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
    select: (rows) => activeOnly ? rows.filter((row) => row.is_active) : rows,
  });
