export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          company_address: string
          company_city_state_zip: string
          company_name: string
          company_phone: string
          delivery_overage_base_fee: number
          delivery_overage_per_mile: number
          delivery_tier_1_fee: number
          delivery_tier_1_max_miles: number
          delivery_tier_2_fee: number
          delivery_tier_2_max_miles: number
          delivery_tier_3_fee: number
          delivery_tier_3_max_miles: number
          id: number
          next_ticket_number: number
          print_copies: number
          print_method: string
          tax_applies_to_delivery: boolean
          tax_rate: number
          ticket_prefix: string
          updated_at: string
        }
        Insert: {
          company_address?: string
          company_city_state_zip?: string
          company_name?: string
          company_phone?: string
          delivery_overage_base_fee?: number
          delivery_overage_per_mile?: number
          delivery_tier_1_fee?: number
          delivery_tier_1_max_miles?: number
          delivery_tier_2_fee?: number
          delivery_tier_2_max_miles?: number
          delivery_tier_3_fee?: number
          delivery_tier_3_max_miles?: number
          id?: number
          next_ticket_number?: number
          print_copies?: number
          print_method?: string
          tax_applies_to_delivery?: boolean
          tax_rate?: number
          ticket_prefix?: string
          updated_at?: string
        }
        Update: {
          company_address?: string
          company_city_state_zip?: string
          company_name?: string
          company_phone?: string
          delivery_overage_base_fee?: number
          delivery_overage_per_mile?: number
          delivery_tier_1_fee?: number
          delivery_tier_1_max_miles?: number
          delivery_tier_2_fee?: number
          delivery_tier_2_max_miles?: number
          delivery_tier_3_fee?: number
          delivery_tier_3_max_miles?: number
          id?: number
          next_ticket_number?: number
          print_copies?: number
          print_method?: string
          tax_applies_to_delivery?: boolean
          tax_rate?: number
          ticket_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          created_at: string
          full_load_price: number
          full_load_yards: number
          id: string
          is_active: boolean
          name: string
          price_per_yard: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_load_price?: number
          full_load_yards?: number
          id?: string
          is_active?: boolean
          name: string
          price_per_yard?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_load_price?: number
          full_load_yards?: number
          id?: string
          is_active?: boolean
          name?: string
          price_per_yard?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      ticket_items: {
        Row: {
          created_at: string
          id: string
          is_full_load: boolean
          line_total: number
          loads: number | null
          material_id: string | null
          material_name: string
          rate_used: number
          superseded_at: string | null
          ticket_id: string
          yards: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_full_load?: boolean
          line_total?: number
          loads?: number | null
          material_id?: string | null
          material_name: string
          rate_used?: number
          superseded_at?: string | null
          ticket_id: string
          yards?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_full_load?: boolean
          line_total?: number
          loads?: number | null
          material_id?: string | null
          material_name?: string
          rate_used?: number
          superseded_at?: string | null
          ticket_id?: string
          yards?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_history: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          after_snapshot: Json | null
          before_snapshot: Json | null
          created_at: string
          event_type: string
          id: string
          reason: string | null
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          event_type: string
          id?: string
          reason?: string | null
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          reason?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          client_request_id: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string
          delivery_fee_per_load: number
          delivery_miles: number | null
          delivery_total: number
          delivery_type: string
          driver_id: string | null
          grand_total: number
          id: string
          job_site_address: string
          load_count: number
          materials_subtotal: number
          notes: string | null
          payment_status: string
          printed_at: string | null
          status: string | null
          tax_amount: number
          tax_applies_to_delivery: boolean | null
          tax_rate: number
          ticket_number: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee_per_load?: number
          delivery_miles?: number | null
          delivery_total?: number
          delivery_type?: string
          driver_id?: string | null
          grand_total?: number
          id?: string
          job_site_address?: string
          load_count?: number
          materials_subtotal?: number
          notes?: string | null
          payment_status?: string
          printed_at?: string | null
          status?: string | null
          tax_amount?: number
          tax_applies_to_delivery?: boolean | null
          tax_rate?: number
          ticket_number: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee_per_load?: number
          delivery_miles?: number | null
          delivery_total?: number
          delivery_type?: string
          driver_id?: string | null
          grand_total?: number
          id?: string
          job_site_address?: string
          load_count?: number
          materials_subtotal?: number
          notes?: string | null
          payment_status?: string
          printed_at?: string | null
          status?: string | null
          tax_amount?: number
          tax_applies_to_delivery?: boolean | null
          tax_rate?: number
          ticket_number?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      correct_ticket_atomic: {
        Args: {
          p_items: Json
          p_reason: string
          p_ticket: Json
          p_ticket_id: string
        }
        Returns: {
          id: string
          ticket_number: string
        }[]
      }
      create_ticket_atomic: {
        Args: {
          p_client_request_id: string
          p_items: Json
          p_preserve_legacy_unknowns?: boolean
          p_ticket: Json
        }
        Returns: {
          created: boolean
          id: string
          ticket_number: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      is_admin_or_staff: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      next_ticket_number: { Args: never; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      validate_ticket_payload: {
        Args: {
          p_items: Json
          p_preserve_legacy_unknowns?: boolean
          p_ticket: Json
        }
        Returns: undefined
      }
      void_ticket: {
        Args: { p_reason: string; p_ticket_id: string }
        Returns: {
          id: string
          ticket_number: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
