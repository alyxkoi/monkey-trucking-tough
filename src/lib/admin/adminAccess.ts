import type { Database } from "@/integrations/supabase/types";

export type AdminRole = Database["public"]["Enums"]["app_role"];

export const isAuthorizedRole = (role: string): role is AdminRole => role === "admin" || role === "staff";
