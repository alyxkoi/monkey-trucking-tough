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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_history: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          created_at: string
          customer_id: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          metadata: Json
          summary: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          customer_id?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json
          summary: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          customer_id?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_audit_logs: {
        Row: {
          actor_id: string | null
          automation_rule_id: string | null
          concise_rationale: string | null
          created_at: string
          customer_id: string | null
          decision: Json | null
          error_code: string | null
          error_message: string | null
          evaluation_type: string
          id: string
          language: string | null
          latency_ms: number | null
          lead_id: string | null
          model_id: string | null
          prompt_version: string
          status: string
          tool_results: Json
        }
        Insert: {
          actor_id?: string | null
          automation_rule_id?: string | null
          concise_rationale?: string | null
          created_at?: string
          customer_id?: string | null
          decision?: Json | null
          error_code?: string | null
          error_message?: string | null
          evaluation_type: string
          id?: string
          language?: string | null
          latency_ms?: number | null
          lead_id?: string | null
          model_id?: string | null
          prompt_version: string
          status: string
          tool_results?: Json
        }
        Update: {
          actor_id?: string | null
          automation_rule_id?: string | null
          concise_rationale?: string | null
          created_at?: string
          customer_id?: string | null
          decision?: Json | null
          error_code?: string | null
          error_message?: string | null
          evaluation_type?: string
          id?: string
          language?: string | null
          latency_ms?: number | null
          lead_id?: string | null
          model_id?: string | null
          prompt_version?: string
          status?: string
          tool_results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_logs_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_state: {
        Row: {
          customer_id: string
          known_facts: Json
          last_evaluated_message_id: string | null
          lead_id: string
          missing_facts: Json
          uncertain_facts: Json
          updated_at: string
        }
        Insert: {
          customer_id: string
          known_facts?: Json
          last_evaluated_message_id?: string | null
          lead_id: string
          missing_facts?: Json
          uncertain_facts?: Json
          updated_at?: string
        }
        Update: {
          customer_id?: string
          known_facts?: Json
          last_evaluated_message_id?: string | null
          lead_id?: string
          missing_facts?: Json
          uncertain_facts?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_state_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_state_last_evaluated_message_id_fkey"
            columns: ["last_evaluated_message_id"]
            isOneToOne: false
            referencedRelation: "lead_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_state_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_drafts: {
        Row: {
          audit_log_id: string
          automation_rule_id: string | null
          body: string
          created_at: string
          created_by: string | null
          customer_id: string
          decision: Json
          id: string
          language: string
          lead_id: string | null
          status: string
        }
        Insert: {
          audit_log_id: string
          automation_rule_id?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          decision: Json
          id?: string
          language: string
          lead_id?: string | null
          status?: string
        }
        Update: {
          audit_log_id?: string
          automation_rule_id?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          decision?: Json
          id?: string
          language?: string
          lead_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_drafts_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "ai_audit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_drafts_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_drafts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
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
          tax_enabled: boolean
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
          tax_enabled?: boolean
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
          tax_enabled?: boolean
          tax_rate?: number
          ticket_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      attention_snoozes: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          returns_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          returns_at: string
          user_id?: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          returns_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action_description: string
          conditions: Json
          delay_description: string
          fallback_description: string
          id: string
          log_description: string
          name: string
          status: string
          stop_conditions: Json
          trigger_description: string
          updated_at: string
        }
        Insert: {
          action_description: string
          conditions?: Json
          delay_description: string
          fallback_description: string
          id: string
          log_description: string
          name: string
          status?: string
          stop_conditions?: Json
          trigger_description: string
          updated_at?: string
        }
        Update: {
          action_description?: string
          conditions?: Json
          delay_description?: string
          fallback_description?: string
          id?: string
          log_description?: string
          name?: string
          status?: string
          stop_conditions?: Json
          trigger_description?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          campaign: string | null
          consent_disclosure_text: string
          consent_disclosure_version: string
          consent_source: string
          customer_id: string | null
          email: string
          email_message_id: string
          id: string
          lead_id: string | null
          message: string | null
          name: string
          phone: string
          project_type: string | null
          sms_consent: boolean
          sms_consent_at: string | null
          source: string | null
          submitted_at: string
          tracking_link_id: string | null
        }
        Insert: {
          campaign?: string | null
          consent_disclosure_text: string
          consent_disclosure_version: string
          consent_source: string
          customer_id?: string | null
          email: string
          email_message_id: string
          id?: string
          lead_id?: string | null
          message?: string | null
          name: string
          phone: string
          project_type?: string | null
          sms_consent?: boolean
          sms_consent_at?: string | null
          source?: string | null
          submitted_at?: string
          tracking_link_id?: string | null
        }
        Update: {
          campaign?: string | null
          consent_disclosure_text?: string
          consent_disclosure_version?: string
          consent_source?: string
          customer_id?: string | null
          email?: string
          email_message_id?: string
          id?: string
          lead_id?: string | null
          message?: string | null
          name?: string
          phone?: string
          project_type?: string | null
          sms_consent?: boolean
          sms_consent_at?: string | null
          source?: string | null
          submitted_at?: string
          tracking_link_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_submissions_tracking_link_id_fkey"
            columns: ["tracking_link_id"]
            isOneToOne: false
            referencedRelation: "tracking_link_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_submissions_tracking_link_id_fkey"
            columns: ["tracking_link_id"]
            isOneToOne: false
            referencedRelation: "tracking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      control_center_settings: {
        Row: {
          ai_status: string
          business_number: string | null
          calling_status: string
          company_email: string | null
          custom_work_tax_rule: string
          default_invoice_due_days: number
          email_status: string
          id: number
          payment_processor_status: string
          printable_logo_status: string
          processing_fee_enabled: boolean
          processing_fee_rate: number
          review_url: string | null
          sms_status: string
          updated_at: string
        }
        Insert: {
          ai_status?: string
          business_number?: string | null
          calling_status?: string
          company_email?: string | null
          custom_work_tax_rule?: string
          default_invoice_due_days?: number
          email_status?: string
          id?: number
          payment_processor_status?: string
          printable_logo_status?: string
          processing_fee_enabled?: boolean
          processing_fee_rate?: number
          review_url?: string | null
          sms_status?: string
          updated_at?: string
        }
        Update: {
          ai_status?: string
          business_number?: string | null
          calling_status?: string
          company_email?: string | null
          custom_work_tax_rule?: string
          default_invoice_due_days?: number
          email_status?: string
          id?: number
          payment_processor_status?: string
          printable_logo_status?: string
          processing_fee_enabled?: boolean
          processing_fee_rate?: number
          review_url?: string | null
          sms_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_document_tokens: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          document_type: string
          first_viewed_at: string | null
          id: string
          invoice_id: string | null
          latest_viewed_at: string | null
          quote_id: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          document_type: string
          first_viewed_at?: string | null
          id?: string
          invoice_id?: string | null
          latest_viewed_at?: string | null
          quote_id?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          document_type?: string
          first_viewed_at?: string | null
          id?: string
          invoice_id?: string | null
          latest_viewed_at?: string | null
          quote_id?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_document_tokens_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_tokens_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          last_activity_at: string
          name: string
          normalized_email: string | null
          normalized_phone: string | null
          notes: string | null
          phone: string | null
          sms_consent_at: string | null
          sms_consent_source: string | null
          sms_opted_out_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_activity_at?: string
          name: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          phone?: string | null
          sms_consent_at?: string | null
          sms_consent_source?: string | null
          sms_opted_out_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_activity_at?: string
          name?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          notes?: string | null
          phone?: string | null
          sms_consent_at?: string | null
          sms_consent_source?: string | null
          sms_opted_out_at?: string | null
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
          accepted_at: string | null
          attempted_at: string | null
          created_at: string
          customer_id: string | null
          document_token_id: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          message_id: string | null
          metadata: Json | null
          payment_id: string | null
          provider_message_id: string | null
          quote_id: string | null
          recipient_email: string
          reply_to: string | null
          sender_email: string | null
          status: string
          template_name: string
          template_type: string | null
        }
        Insert: {
          accepted_at?: string | null
          attempted_at?: string | null
          created_at?: string
          customer_id?: string | null
          document_token_id?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          message_id?: string | null
          metadata?: Json | null
          payment_id?: string | null
          provider_message_id?: string | null
          quote_id?: string | null
          recipient_email: string
          reply_to?: string | null
          sender_email?: string | null
          status: string
          template_name: string
          template_type?: string | null
        }
        Update: {
          accepted_at?: string | null
          attempted_at?: string | null
          created_at?: string
          customer_id?: string | null
          document_token_id?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          message_id?: string | null
          metadata?: Json | null
          payment_id?: string | null
          provider_message_id?: string | null
          quote_id?: string | null
          recipient_email?: string
          reply_to?: string | null
          sender_email?: string | null
          status?: string
          template_name?: string
          template_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_document_token_id_fkey"
            columns: ["document_token_id"]
            isOneToOne: false
            referencedRelation: "customer_document_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
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
      financial_history: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          after_snapshot: Json | null
          before_snapshot: Json | null
          created_at: string
          event_type: string
          id: string
          reason: string
          record_id: string
          record_type: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          event_type: string
          id?: string
          reason: string
          record_id: string
          record_type: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          reason?: string
          record_id?: string
          record_type?: string
        }
        Relationships: []
      }
      invoice_tickets: {
        Row: {
          created_at: string
          invoice_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          invoice_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          invoice_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tickets_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          amount_source: string
          created_at: string
          created_by: string | null
          customer_id: string
          description: string
          dispute_note: string | null
          disputed: boolean
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          job_id: string | null
          paid_at: string | null
          payment_claim_method: string | null
          payment_claim_note: string | null
          payment_claimed_at: string | null
          processing_fee_amount: number | null
          processing_fee_rate: number | null
          quote_id: string | null
          standalone_ticket_id: string | null
          status: string
          subtotal_amount: number | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          amount_source: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          description: string
          dispute_note?: string | null
          disputed?: boolean
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          job_id?: string | null
          paid_at?: string | null
          payment_claim_method?: string | null
          payment_claim_note?: string | null
          payment_claimed_at?: string | null
          processing_fee_amount?: number | null
          processing_fee_rate?: number | null
          quote_id?: string | null
          standalone_ticket_id?: string | null
          status?: string
          subtotal_amount?: number | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          amount_source?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string
          dispute_note?: string | null
          disputed?: boolean
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          job_id?: string | null
          paid_at?: string | null
          payment_claim_method?: string | null
          payment_claim_note?: string | null
          payment_claimed_at?: string | null
          processing_fee_amount?: number | null
          processing_fee_rate?: number | null
          quote_id?: string | null
          standalone_ticket_id?: string | null
          status?: string
          subtotal_amount?: number | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_standalone_ticket_id_fkey"
            columns: ["standalone_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string
          agreed_amount: number
          all_day: boolean
          blocked_at: string | null
          blocked_reason: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          category: string
          change_requested: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          description: string
          id: string
          notes: string | null
          quote_id: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          agreed_amount?: number
          all_day?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category: string
          change_requested?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          description: string
          id?: string
          notes?: string | null
          quote_id?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          agreed_amount?: number
          all_day?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category?: string
          change_requested?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string
          id?: string
          notes?: string | null
          quote_id?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_messages: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_status: string
          id: string
          lead_id: string
          provider_message_id: string | null
          sender_type: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_status?: string
          id?: string
          lead_id: string
          provider_message_id?: string | null
          sender_type: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_status?: string
          id?: string
          lead_id?: string
          provider_message_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          campaign: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          human_takeover: boolean
          id: string
          last_contact_at: string | null
          lost_reason: string | null
          need: string
          source: string
          status: string
          tracking_link_id: string | null
          updated_at: string
        }
        Insert: {
          campaign?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          human_takeover?: boolean
          id?: string
          last_contact_at?: string | null
          lost_reason?: string | null
          need: string
          source: string
          status?: string
          tracking_link_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          human_takeover?: boolean
          id?: string
          last_contact_at?: string | null
          lost_reason?: string | null
          need?: string
          source?: string
          status?: string
          tracking_link_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tracking_link_id_fkey"
            columns: ["tracking_link_id"]
            isOneToOne: false
            referencedRelation: "tracking_link_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tracking_link_id_fkey"
            columns: ["tracking_link_id"]
            isOneToOne: false
            referencedRelation: "tracking_links"
            referencedColumns: ["id"]
          },
        ]
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
      payments: {
        Row: {
          amount: number
          confirmed_by: string
          customer_id: string
          id: string
          invoice_id: string
          method: string
          note: string | null
          payment_source: string | null
          provider_payment_method_type: string | null
          received_at: string
          recorded_at: string
          recorded_by: string | null
          stripe_checkout_session_id: string | null
          stripe_event_id: string | null
          stripe_payment_intent_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          confirmed_by: string
          customer_id: string
          id?: string
          invoice_id: string
          method: string
          note?: string | null
          payment_source?: string | null
          provider_payment_method_type?: string | null
          received_at: string
          recorded_at?: string
          recorded_by?: string | null
          stripe_checkout_session_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          confirmed_by?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          method?: string
          note?: string | null
          payment_source?: string | null
          provider_payment_method_type?: string | null
          received_at?: string
          recorded_at?: string
          recorded_by?: string | null
          stripe_checkout_session_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          is_full_load: boolean
          kind: string
          line_total: number
          loads: number | null
          material_id: string | null
          quote_id: string
          rate_used: number
          yards: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_full_load?: boolean
          kind: string
          line_total?: number
          loads?: number | null
          material_id?: string | null
          quote_id: string
          rate_used?: number
          yards?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_full_load?: boolean
          kind?: string
          line_total?: number
          loads?: number | null
          material_id?: string | null
          quote_id?: string
          rate_used?: number
          yards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          address: string
          created_at: string
          created_by: string | null
          custom_work_subtotal: number
          custom_work_tax_rule: string
          customer_id: string
          declined_at: string | null
          delivery_fee_per_load: number
          delivery_load_count: number
          delivery_miles: number | null
          delivery_total: number
          delivery_type: string | null
          description: string
          grand_total: number
          id: string
          lead_id: string | null
          materials_subtotal: number
          notes: string | null
          quote_number: string
          sent_at: string | null
          status: string
          tax_amount: number
          tax_applies_to_delivery: boolean
          tax_rate: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          address?: string
          created_at?: string
          created_by?: string | null
          custom_work_subtotal?: number
          custom_work_tax_rule?: string
          customer_id: string
          declined_at?: string | null
          delivery_fee_per_load?: number
          delivery_load_count?: number
          delivery_miles?: number | null
          delivery_total?: number
          delivery_type?: string | null
          description?: string
          grand_total?: number
          id?: string
          lead_id?: string | null
          materials_subtotal?: number
          notes?: string | null
          quote_number: string
          sent_at?: string | null
          status?: string
          tax_amount?: number
          tax_applies_to_delivery?: boolean
          tax_rate?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          address?: string
          created_at?: string
          created_by?: string | null
          custom_work_subtotal?: number
          custom_work_tax_rule?: string
          customer_id?: string
          declined_at?: string | null
          delivery_fee_per_load?: number
          delivery_load_count?: number
          delivery_miles?: number | null
          delivery_total?: number
          delivery_type?: string | null
          description?: string
          grand_total?: number
          id?: string
          lead_id?: string | null
          materials_subtotal?: number
          notes?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: string
          tax_amount?: number
          tax_applies_to_delivery?: boolean
          tax_rate?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_checkout_sessions: {
        Row: {
          amount_cents: number
          checkout_url: string | null
          created_at: string
          currency: string
          document_token_id: string
          expires_at: string | null
          failure_reason: string | null
          id: string
          invoice_id: string
          livemode: boolean | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          document_token_id: string
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id: string
          livemode?: boolean | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          document_token_id?: string
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string
          livemode?: boolean | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_checkout_sessions_document_token_id_fkey"
            columns: ["document_token_id"]
            isOneToOne: false
            referencedRelation: "customer_document_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_checkout_sessions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          attempt_count: number
          error_message: string | null
          event_type: string
          invoice_id: string | null
          livemode: boolean | null
          payment_id: string | null
          processed_at: string | null
          provider_event_id: string
          receipt_email_status: string | null
          received_at: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          error_message?: string | null
          event_type: string
          invoice_id?: string | null
          livemode?: boolean | null
          payment_id?: string | null
          processed_at?: string | null
          provider_event_id: string
          receipt_email_status?: string | null
          received_at?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          error_message?: string | null
          event_type?: string
          invoice_id?: string | null
          livemode?: boolean | null
          payment_id?: string | null
          processed_at?: string | null
          provider_event_id?: string
          receipt_email_status?: string | null
          received_at?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_webhook_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
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
      ticket_deletion_audit: {
        Row: {
          deleted_at: string
          deleted_by: string
          id: string
          job_id: string | null
          reason: string
          ticket_id: string
          ticket_number: string
          was_job_linked: boolean
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string
          id?: string
          job_id?: string | null
          reason: string
          ticket_id: string
          ticket_number: string
          was_job_linked: boolean
        }
        Update: {
          deleted_at?: string
          deleted_by?: string
          id?: string
          job_id?: string | null
          reason?: string
          ticket_id?: string
          ticket_number?: string
          was_job_linked?: boolean
        }
        Relationships: []
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
      tickets: {
        Row: {
          client_request_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_fee_per_load: number
          delivery_miles: number | null
          delivery_total: number
          delivery_type: string
          driver_id: string | null
          grand_total: number
          id: string
          job_id: string | null
          job_site_address: string
          load_count: number
          materials_subtotal: number
          notes: string | null
          payment_status: string
          printed_at: string | null
          status: string
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
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee_per_load?: number
          delivery_miles?: number | null
          delivery_total?: number
          delivery_type?: string
          driver_id?: string | null
          grand_total?: number
          id?: string
          job_id?: string | null
          job_site_address?: string
          load_count?: number
          materials_subtotal?: number
          notes?: string | null
          payment_status?: string
          printed_at?: string | null
          status?: string
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
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee_per_load?: number
          delivery_miles?: number | null
          delivery_total?: number
          delivery_type?: string
          driver_id?: string | null
          grand_total?: number
          id?: string
          job_id?: string | null
          job_site_address?: string
          load_count?: number
          materials_subtotal?: number
          notes?: string | null
          payment_status?: string
          printed_at?: string | null
          status?: string
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
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_link_visits: {
        Row: {
          id: string
          tracking_link_id: string
          visited_at: string
        }
        Insert: {
          id?: string
          tracking_link_id: string
          visited_at?: string
        }
        Update: {
          id?: string
          tracking_link_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_link_visits_tracking_link_id_fkey"
            columns: ["tracking_link_id"]
            isOneToOne: false
            referencedRelation: "tracking_link_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_link_visits_tracking_link_id_fkey"
            columns: ["tracking_link_id"]
            isOneToOne: false
            referencedRelation: "tracking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_links: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          campaign: string
          created_at: string
          created_by: string | null
          customers: number
          destination: string
          id: string
          is_active: boolean
          leads: number
          slug: string
          source: string
          visits: number
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          campaign: string
          created_at?: string
          created_by?: string | null
          customers?: number
          destination: string
          id?: string
          is_active?: boolean
          leads?: number
          slug: string
          source: string
          visits?: number
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          campaign?: string
          created_at?: string
          created_by?: string | null
          customers?: number
          destination?: string
          id?: string
          is_active?: boolean
          leads?: number
          slug?: string
          source?: string
          visits?: number
        }
        Relationships: []
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
      worker_payments: {
        Row: {
          amount: number
          attachment_path: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          hours: number | null
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          rate: number | null
          source: string
          status: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          worker_id: string
        }
        Insert: {
          amount: number
          attachment_path?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          hours?: number | null
          id?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          rate?: number | null
          source: string
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          worker_id: string
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          hours?: number | null
          id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          rate?: number | null
          source?: string
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          hourly_rate: number | null
          id: string
          is_active: boolean
          is_driver: boolean
          name: string
          notes: string | null
          pay_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          is_driver?: boolean
          name: string
          notes?: string | null
          pay_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          is_driver?: boolean
          name?: string
          notes?: string | null
          pay_type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      tracking_link_metrics: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          campaign: string | null
          created_at: string | null
          created_by: string | null
          customers: number | null
          destination: string | null
          id: string | null
          is_active: boolean | null
          leads: number | null
          slug: string | null
          source: string | null
          visits: number | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          campaign?: string | null
          created_at?: string | null
          created_by?: string | null
          customers?: never
          destination?: string | null
          id?: string | null
          is_active?: boolean | null
          leads?: never
          slug?: string | null
          source?: string | null
          visits?: never
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          campaign?: string | null
          created_at?: string | null
          created_by?: string | null
          customers?: never
          destination?: string | null
          id?: string | null
          is_active?: boolean | null
          leads?: never
          slug?: string | null
          source?: string | null
          visits?: never
        }
        Relationships: []
      }
    }
    Functions: {
      accept_public_quote: {
        Args: { p_token_hash: string }
        Returns: {
          accepted_at: string
          quote_id: string
          status: string
        }[]
      }
      activate_stripe_checkout_session: {
        Args: {
          p_checkout_url: string
          p_expires_at: string
          p_livemode: boolean
          p_reservation_id: string
          p_stripe_session_id: string
        }
        Returns: undefined
      }
      complete_job_and_prepare_invoice: {
        Args: { p_job_id: string }
        Returns: string
      }
      confirm_worker_payment_details: {
        Args: { p_worker_payment_id: string }
        Returns: undefined
      }
      correct_ticket_atomic: {
        Args: {
          p_items: Json
          p_reason: string
          p_ticket: Json
          p_ticket_id: string
        }
        Returns: {
          client_request_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_fee_per_load: number
          delivery_miles: number | null
          delivery_total: number
          delivery_type: string
          driver_id: string | null
          grand_total: number
          id: string
          job_id: string | null
          job_site_address: string
          load_count: number
          materials_subtotal: number
          notes: string | null
          payment_status: string
          printed_at: string | null
          status: string
          tax_amount: number
          tax_applies_to_delivery: boolean | null
          tax_rate: number
          ticket_number: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_control_center_ticket_atomic: {
        Args: {
          p_client_request_id: string
          p_customer_id: string
          p_items: Json
          p_job_id?: string
          p_preserve_legacy_unknowns?: boolean
          p_ticket: Json
        }
        Returns: {
          created: boolean
          id: string
          ticket_number: string
        }[]
      }
      create_invoice_from_job: { Args: { p_job_id: string }; Returns: string }
      create_invoice_from_standalone_ticket: {
        Args: { p_ticket_id: string }
        Returns: string
      }
      create_job_with_customer: {
        Args: {
          p_address: string
          p_agreed_amount: number
          p_all_day: boolean
          p_category: string
          p_customer_id: string
          p_date: string
          p_description: string
          p_email: string
          p_name: string
          p_notes: string
          p_phone: string
          p_quote_id: string
          p_time: string
        }
        Returns: string
      }
      create_lead_with_customer: {
        Args: {
          p_campaign: string
          p_email: string
          p_name: string
          p_need: string
          p_phone: string
          p_source: string
        }
        Returns: {
          customer_id: string
          lead_id: string
          matched_existing: boolean
        }[]
      }
      create_quote_draft_from_lead: {
        Args: { p_lead_id: string }
        Returns: {
          id: string
          quote_number: string
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
          client_request_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_fee_per_load: number
          delivery_miles: number | null
          delivery_total: number
          delivery_type: string
          driver_id: string | null
          grand_total: number
          id: string
          job_id: string | null
          job_site_address: string
          load_count: number
          materials_subtotal: number
          notes: string | null
          payment_status: string
          printed_at: string | null
          status: string
          tax_amount: number
          tax_applies_to_delivery: boolean | null
          tax_rate: number
          ticket_number: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_ticket_compat_atomic: {
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
      create_worker_payment_pending: {
        Args: {
          p_amount: number
          p_attachment_path?: string
          p_hours: number
          p_period_end: string
          p_period_start: string
          p_rate: number
          p_source: string
          p_worker_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_material_if_unused: {
        Args: { p_material_id: string }
        Returns: Json
      }
      delete_ticket_permanently: {
        Args: { p_confirmation: string; p_reason: string; p_ticket_id: string }
        Returns: Json
      }
      delete_tracking_link_if_unused: {
        Args: { p_tracking_link_id: string }
        Returns: Json
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      fail_stripe_checkout_session: {
        Args: { p_reason: string; p_reservation_id: string }
        Returns: undefined
      }
      finalize_customer_email_send: {
        Args: {
          p_due_at?: string
          p_log_id: string
          p_provider_message_id: string
        }
        Returns: undefined
      }
      find_or_create_customer: {
        Args: { p_email?: string; p_name: string; p_phone?: string }
        Returns: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          last_activity_at: string
          name: string
          normalized_email: string | null
          normalized_phone: string | null
          notes: string | null
          phone: string | null
          sms_consent_at: string | null
          sms_consent_source: string | null
          sms_opted_out_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin_or_staff:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      mark_stripe_checkout_terminal: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_livemode: boolean
          p_status: string
          p_stripe_session_id: string
        }
        Returns: undefined
      }
      mark_worker_payment_paid: {
        Args: { p_worker_payment_id: string }
        Returns: undefined
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
      next_invoice_number: { Args: never; Returns: string }
      next_quote_number: { Args: never; Returns: string }
      next_ticket_number: { Args: never; Returns: string }
      process_stripe_checkout_payment: {
        Args: {
          p_amount_cents: number
          p_currency: string
          p_event_id: string
          p_event_type: string
          p_livemode: boolean
          p_paid_at: string
          p_provider_payment_method_type: string
          p_stripe_payment_intent_id: string
          p_stripe_session_id: string
        }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_invoice_payment_full: {
        Args: {
          p_invoice_id: string
          p_method: string
          p_note?: string
          p_received_at: string
        }
        Returns: string
      }
      reserve_stripe_checkout_session: {
        Args: {
          p_amount_cents: number
          p_document_token_id: string
          p_invoice_id: string
        }
        Returns: {
          amount_cents: number
          checkout_url: string | null
          created_at: string
          currency: string
          document_token_id: string
          expires_at: string | null
          failure_reason: string | null
          id: string
          invoice_id: string
          livemode: boolean | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "stripe_checkout_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revise_draft_invoice: {
        Args: {
          p_amount: number
          p_description: string
          p_invoice_id: string
          p_reason: string
        }
        Returns: undefined
      }
      save_quote_atomic: {
        Args: { p_items: Json; p_quote: Json }
        Returns: {
          id: string
          quote_number: string
        }[]
      }
      set_tracking_link_archived: {
        Args: { p_archived: boolean; p_tracking_link_id: string }
        Returns: undefined
      }
      void_financial_record: {
        Args: { p_reason: string; p_record_id: string; p_record_type: string }
        Returns: undefined
      }
      void_ticket: {
        Args: { p_reason: string; p_ticket_id: string }
        Returns: {
          client_request_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_fee_per_load: number
          delivery_miles: number | null
          delivery_total: number
          delivery_type: string
          driver_id: string | null
          grand_total: number
          id: string
          job_id: string | null
          job_site_address: string
          load_count: number
          materials_subtotal: number
          notes: string | null
          payment_status: string
          printed_at: string | null
          status: string
          tax_amount: number
          tax_applies_to_delivery: boolean | null
          tax_rate: number
          ticket_number: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: false
          isSetofReturn: true
        }
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
