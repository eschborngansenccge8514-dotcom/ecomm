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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean | null
          label: string
          lat: number | null
          lng: number | null
          location: unknown
          phone: string
          postcode: string
          recipient_name: string
          state: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          phone: string
          postcode: string
          recipient_name: string
          state: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          phone?: string
          postcode?: string
          recipient_name?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_reservations: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          product_id: string
          quantity: number
          status: string | null
          updated_at: string | null
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          product_id: string
          quantity: number
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          product_id?: string
          quantity?: number
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          abandoned_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          items: Json | null
          locked_at: string | null
          locked_by: string | null
          merchant_id: string
          session_id: string | null
          status: string
          subtotal: number | null
          updated_at: string
        }
        Insert: {
          abandoned_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          items?: Json | null
          locked_at?: string | null
          locked_by?: string | null
          merchant_id: string
          session_id?: string | null
          status?: string
          subtotal?: number | null
          updated_at?: string
        }
        Update: {
          abandoned_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          items?: Json | null
          locked_at?: string | null
          locked_by?: string | null
          merchant_id?: string
          session_id?: string | null
          status?: string
          subtotal?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          merchant_id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidated_staging: {
        Row: {
          consolidated_at: string | null
          consolidated_einvoice_id: string | null
          id: string
          merchant_id: string
          order_id: string
          order_number: string
          period_month: number
          period_year: number
          staged_at: string | null
          subtotal: number
          tax_amount: number
        }
        Insert: {
          consolidated_at?: string | null
          consolidated_einvoice_id?: string | null
          id?: string
          merchant_id: string
          order_id: string
          order_number: string
          period_month: number
          period_year: number
          staged_at?: string | null
          subtotal: number
          tax_amount?: number
        }
        Update: {
          consolidated_at?: string | null
          consolidated_einvoice_id?: string | null
          id?: string
          merchant_id?: string
          order_id?: string
          order_number?: string
          period_month?: number
          period_year?: number
          staged_at?: string | null
          subtotal?: number
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "consolidated_staging_consolidated_einvoice_id_fkey"
            columns: ["consolidated_einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidated_staging_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidated_staging_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          order_id: string | null
          provider: string
          raw_payload: Json | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          order_id?: string | null
          provider: string
          raw_payload?: Json | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          provider?: string
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_exception_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          order_id: string | null
          raw_payload: Json | null
          resolved: boolean | null
          resolved_at: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          order_id?: string | null
          raw_payload?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          order_id?: string | null
          raw_payload?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_exception_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_quotes: {
        Row: {
          created_at: string
          currency: string | null
          distance_km: number | null
          estimated_mins: number | null
          expires_at: string | null
          id: string
          order_id: string | null
          provider: Database["public"]["Enums"]["delivery_provider"]
          quoted_price: number
          raw_response: Json | null
          service_type: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          distance_km?: number | null
          estimated_mins?: number | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          provider: Database["public"]["Enums"]["delivery_provider"]
          quoted_price: number
          raw_response?: Json | null
          service_type?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          distance_km?: number | null
          estimated_mins?: number | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          provider?: Database["public"]["Enums"]["delivery_provider"]
          quoted_price?: number
          raw_response?: Json | null
          service_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      easyparcel_api_log: {
        Row: {
          action: string
          attempt: number | null
          created_at: string | null
          error_message: string | null
          id: string
          order_id: string | null
          request_payload: Json | null
          response_payload: Json | null
        }
        Insert: {
          action: string
          attempt?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
        }
        Update: {
          action?: string
          attempt?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "easyparcel_api_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_audit_log: {
        Row: {
          action: string | null
          created_at: string | null
          duration_ms: number | null
          endpoint: string | null
          id: string
          merchant_id: string
          order_id: string | null
          request_body: Json | null
          response_body: Json | null
          status_code: number | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          id?: string
          merchant_id: string
          order_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          id?: string
          merchant_id?: string
          order_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_audit_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoice_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_production_log: {
        Row: {
          amount: number | null
          id: string
          invoice_type: string | null
          issued_at: string | null
          lhdn_long_id: string | null
          lhdn_uuid: string
          merchant_id: string
          order_number: string
          tax_period_month: number | null
          tax_period_year: number | null
        }
        Insert: {
          amount?: number | null
          id?: string
          invoice_type?: string | null
          issued_at?: string | null
          lhdn_long_id?: string | null
          lhdn_uuid: string
          merchant_id: string
          order_number: string
          tax_period_month?: number | null
          tax_period_year?: number | null
        }
        Update: {
          amount?: number | null
          id?: string
          invoice_type?: string | null
          issued_at?: string | null
          lhdn_long_id?: string | null
          lhdn_uuid?: string
          merchant_id?: string
          order_number?: string
          tax_period_month?: number | null
          tax_period_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_production_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoices: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          invoice_type: string
          lhdn_long_id: string | null
          lhdn_uuid: string | null
          merchant_id: string
          order_id: string
          order_number: string
          qr_code_url: string | null
          status: string
          submission_uid: string | null
          submitted_at: string | null
          updated_at: string | null
          validated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          invoice_type?: string
          lhdn_long_id?: string | null
          lhdn_uuid?: string | null
          merchant_id: string
          order_id: string
          order_number: string
          qr_code_url?: string | null
          status?: string
          submission_uid?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          validated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          invoice_type?: string
          lhdn_long_id?: string | null
          lhdn_uuid?: string | null
          merchant_id?: string
          order_id?: string
          order_number?: string
          qr_code_url?: string | null
          status?: string
          submission_uid?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_invoice_jobs: {
        Row: {
          attempts: number | null
          error: string | null
          failed_at: string | null
          id: string
          job_type: string | null
          merchant_id: string
          order_id: string | null
          payload: Json | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          attempts?: number | null
          error?: string | null
          failed_at?: string | null
          id?: string
          job_type?: string | null
          merchant_id: string
          order_id?: string | null
          payload?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          attempts?: number | null
          error?: string | null
          failed_at?: string | null
          id?: string
          job_type?: string | null
          merchant_id?: string
          order_id?: string | null
          payload?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_invoice_jobs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failed_invoice_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      google_merchant_data_sources: {
        Row: {
          content_language: string
          countries: string[]
          created_at: string
          data_source_id: string
          display_name: string
          feed_label: string
          id: string
          is_primary: boolean
          marketplace_account_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          content_language?: string
          countries?: string[]
          created_at?: string
          data_source_id: string
          display_name: string
          feed_label: string
          id?: string
          is_primary?: boolean
          marketplace_account_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          content_language?: string
          countries?: string[]
          created_at?: string
          data_source_id?: string
          display_name?: string
          feed_label?: string
          id?: string
          is_primary?: boolean
          marketplace_account_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_merchant_data_sources_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_merchant_data_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_merchant_diagnostics: {
        Row: {
          affected_count: number | null
          attribute_name: string | null
          country: string | null
          created_at: string
          description: string | null
          destination: string | null
          documentation_url: string | null
          external_product_id: string | null
          id: string
          issue_code: string
          marketplace_account_id: string
          resolution: string | null
          resolved_at: string | null
          scope: Database["public"]["Enums"]["diagnostic_scope"]
          servability: string | null
          severity: Database["public"]["Enums"]["diagnostic_severity"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_count?: number | null
          attribute_name?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          destination?: string | null
          documentation_url?: string | null
          external_product_id?: string | null
          id?: string
          issue_code: string
          marketplace_account_id: string
          resolution?: string | null
          resolved_at?: string | null
          scope: Database["public"]["Enums"]["diagnostic_scope"]
          servability?: string | null
          severity: Database["public"]["Enums"]["diagnostic_severity"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_count?: number | null
          attribute_name?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          destination?: string | null
          documentation_url?: string | null
          external_product_id?: string | null
          id?: string
          issue_code?: string
          marketplace_account_id?: string
          resolution?: string | null
          resolved_at?: string | null
          scope?: Database["public"]["Enums"]["diagnostic_scope"]
          servability?: string | null
          severity?: Database["public"]["Enums"]["diagnostic_severity"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_merchant_diagnostics_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_merchant_diagnostics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      lalamove_api_log: {
        Row: {
          attempt: number | null
          created_at: string | null
          endpoint: string
          id: string
          method: string
          order_id: string | null
          request_body: Json | null
          response_body: Json | null
          status_code: number | null
        }
        Insert: {
          attempt?: number | null
          created_at?: string | null
          endpoint: string
          id?: string
          method: string
          order_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
        }
        Update: {
          attempt?: number | null
          created_at?: string | null
          endpoint?: string
          id?: string
          method?: string
          order_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lalamove_api_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          balance: number
          customer_id: string | null
          id: string
          merchant_id: string | null
          tier: string
          total_earned: number
          total_spent_rm: number
          updated_at: string | null
        }
        Insert: {
          balance?: number
          customer_id?: string | null
          id?: string
          merchant_id?: string | null
          tier?: string
          total_earned?: number
          total_spent_rm?: number
          updated_at?: string | null
        }
        Update: {
          balance?: number
          customer_id?: string | null
          id?: string
          merchant_id?: string | null
          tier?: string
          total_earned?: number
          total_spent_rm?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_settings: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean
          max_redeem_pct: number
          merchant_id: string | null
          min_redeem_points: number
          points_expiry_days: number | null
          points_per_rm: number
          program_name: string
          rm_per_point: number
          tier_gold_multiplier: number
          tier_gold_rm: number
          tier_platinum_multiplier: number
          tier_platinum_rm: number
          tier_silver_multiplier: number
          tier_silver_rm: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          max_redeem_pct?: number
          merchant_id?: string | null
          min_redeem_points?: number
          points_expiry_days?: number | null
          points_per_rm?: number
          program_name?: string
          rm_per_point?: number
          tier_gold_multiplier?: number
          tier_gold_rm?: number
          tier_platinum_multiplier?: number
          tier_platinum_rm?: number
          tier_silver_multiplier?: number
          tier_silver_rm?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          max_redeem_pct?: number
          merchant_id?: string | null
          min_redeem_points?: number
          points_expiry_days?: number | null
          points_per_rm?: number
          program_name?: string
          rm_per_point?: number
          tier_gold_multiplier?: number
          tier_gold_rm?: number
          tier_platinum_multiplier?: number
          tier_platinum_rm?: number
          tier_silver_multiplier?: number
          tier_silver_rm?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_settings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          external_account_id: string
          id: string
          last_health_check_at: string | null
          last_successful_sync_at: string | null
          metadata: Json
          provider: Database["public"]["Enums"]["marketplace_provider"]
          region: string
          site_code: string | null
          status: Database["public"]["Enums"]["account_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          external_account_id: string
          id?: string
          last_health_check_at?: string | null
          last_successful_sync_at?: string | null
          metadata?: Json
          provider: Database["public"]["Enums"]["marketplace_provider"]
          region?: string
          site_code?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          external_account_id?: string
          id?: string
          last_health_check_at?: string | null
          last_successful_sync_at?: string | null
          metadata?: Json
          provider?: Database["public"]["Enums"]["marketplace_provider"]
          region?: string
          site_code?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_credentials: {
        Row: {
          created_at: string
          credential_type: string
          encrypted_payload: string
          expires_at: string | null
          id: string
          is_active: boolean
          marketplace_account_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credential_type: string
          encrypted_payload: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          marketplace_account_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credential_type?: string
          encrypted_payload?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          marketplace_account_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_credentials_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_error_logs: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string
          error_payload: Json | null
          event_id: string | null
          id: string
          job_id: string | null
          marketplace_account_id: string | null
          provider: Database["public"]["Enums"]["marketplace_provider"] | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["diagnostic_severity"]
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message: string
          error_payload?: Json | null
          event_id?: string | null
          id?: string
          job_id?: string | null
          marketplace_account_id?: string | null
          provider?: Database["public"]["Enums"]["marketplace_provider"] | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["diagnostic_severity"]
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string
          error_payload?: Json | null
          event_id?: string | null
          id?: string
          job_id?: string | null
          marketplace_account_id?: string | null
          provider?: Database["public"]["Enums"]["marketplace_provider"] | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["diagnostic_severity"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_error_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_error_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_error_logs_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_error_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_event_dedup: {
        Row: {
          created_at: string
          event_key: string
          provider: string
        }
        Insert: {
          created_at?: string
          event_key: string
          provider: string
        }
        Update: {
          created_at?: string
          event_key?: string
          provider?: string
        }
        Relationships: []
      }
      marketplace_events: {
        Row: {
          correlation_id: string | null
          error_message: string | null
          event_key: string
          event_type: string
          id: string
          marketplace_account_id: string | null
          parsed_payload: Json
          processed_at: string | null
          processing_status: Database["public"]["Enums"]["event_processing_status"]
          provider: Database["public"]["Enums"]["marketplace_provider"]
          raw_payload: Json
          received_at: string
          signature_valid: boolean | null
          tenant_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          error_message?: string | null
          event_key: string
          event_type: string
          id?: string
          marketplace_account_id?: string | null
          parsed_payload?: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["event_processing_status"]
          provider: Database["public"]["Enums"]["marketplace_provider"]
          raw_payload: Json
          received_at?: string
          signature_valid?: boolean | null
          tenant_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          error_message?: string | null
          event_key?: string
          event_type?: string
          id?: string
          marketplace_account_id?: string | null
          parsed_payload?: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["event_processing_status"]
          provider?: Database["public"]["Enums"]["marketplace_provider"]
          raw_payload?: Json
          received_at?: string
          signature_valid?: boolean | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_events_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_mappings: {
        Row: {
          created_at: string
          external_order_id: string
          external_status: string | null
          id: string
          last_synced_at: string | null
          marketplace_account_id: string
          order_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_order_id: string
          external_status?: string | null
          id?: string
          last_synced_at?: string | null
          marketplace_account_id: string
          order_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_order_id?: string
          external_status?: string | null
          id?: string
          last_synced_at?: string | null
          marketplace_account_id?: string
          order_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_mappings_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_mappings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_mappings: {
        Row: {
          created_at: string
          data_source_id: string | null
          external_product_id: string
          id: string
          last_synced_at: string | null
          local_state_hash: string | null
          marketplace_account_id: string
          product_id: string
          remote_state_hash: string | null
          status: Database["public"]["Enums"]["product_mapping_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_source_id?: string | null
          external_product_id: string
          id?: string
          last_synced_at?: string | null
          local_state_hash?: string | null
          marketplace_account_id: string
          product_id: string
          remote_state_hash?: string | null
          status?: Database["public"]["Enums"]["product_mapping_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_source_id?: string | null
          external_product_id?: string
          id?: string
          last_synced_at?: string | null
          local_state_hash?: string | null
          marketplace_account_id?: string
          product_id?: string
          remote_state_hash?: string | null
          status?: Database["public"]["Enums"]["product_mapping_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_mappings_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_providers: {
        Row: {
          config_schema: Json | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          config_schema?: Json | null
          created_at?: string | null
          description?: string | null
          id: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          config_schema?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      marketplace_sync_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          finished_at: string | null
          id: string
          job_type: Database["public"]["Enums"]["sync_job_type"]
          last_error_code: string | null
          last_error_message: string | null
          last_error_payload: Json | null
          lock_token: string | null
          locked_at: string | null
          marketplace_account_id: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          priority: number
          provider: Database["public"]["Enums"]["marketplace_provider"]
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["sync_job_type"]
          last_error_code?: string | null
          last_error_message?: string | null
          last_error_payload?: Json | null
          lock_token?: string | null
          locked_at?: string | null
          marketplace_account_id: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          priority?: number
          provider: Database["public"]["Enums"]["marketplace_provider"]
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["sync_job_type"]
          last_error_code?: string | null
          last_error_message?: string | null
          last_error_payload?: Json | null
          lock_token?: string | null
          locked_at?: string | null
          marketplace_account_id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          priority?: number
          provider?: Database["public"]["Enums"]["marketplace_provider"]
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sync_jobs_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_webhook_subscriptions: {
        Row: {
          address: string
          created_at: string
          event_type: string
          id: string
          last_verified_at: string | null
          marketplace_account_id: string
          metadata: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          event_type: string
          id?: string
          last_verified_at?: string | null
          marketplace_account_id: string
          metadata?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          event_type?: string
          id?: string
          last_verified_at?: string | null
          marketplace_account_id?: string
          metadata?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_webhook_subscriptions_marketplace_account_id_fkey"
            columns: ["marketplace_account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_webhook_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_billplz_config: {
        Row: {
          collection_id: string
          created_at: string
          enabled: boolean
          merchant_id: string
          payment_order_collection_id: string | null
          updated_at: string
          x_signature: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          enabled?: boolean
          merchant_id: string
          payment_order_collection_id?: string | null
          updated_at?: string
          x_signature?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          enabled?: boolean
          merchant_id?: string
          payment_order_collection_id?: string | null
          updated_at?: string
          x_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_billplz_config_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_easyparcel_config: {
        Row: {
          api_key: string | null
          auto_book_on_ready: boolean
          collection_type: string
          created_at: string | null
          default_height_cm: number
          default_length_cm: number
          default_weight_kg: number
          default_width_cm: number
          environment: string
          last_test_result: string | null
          last_tested_at: string | null
          merchant_id: string
          preferred_courier: string | null
          preferred_pickup_date: string | null
          sender_address1: string | null
          sender_address2: string | null
          sender_city: string | null
          sender_company: string | null
          sender_country: string | null
          sender_email: string | null
          sender_name: string | null
          sender_phone: string | null
          sender_postcode: string | null
          sender_state: string | null
          updated_at: string | null
          wallet_balance: number | null
          wallet_updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          auto_book_on_ready?: boolean
          collection_type?: string
          created_at?: string | null
          default_height_cm?: number
          default_length_cm?: number
          default_weight_kg?: number
          default_width_cm?: number
          environment?: string
          last_test_result?: string | null
          last_tested_at?: string | null
          merchant_id: string
          preferred_courier?: string | null
          preferred_pickup_date?: string | null
          sender_address1?: string | null
          sender_address2?: string | null
          sender_city?: string | null
          sender_company?: string | null
          sender_country?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_postcode?: string | null
          sender_state?: string | null
          updated_at?: string | null
          wallet_balance?: number | null
          wallet_updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          auto_book_on_ready?: boolean
          collection_type?: string
          created_at?: string | null
          default_height_cm?: number
          default_length_cm?: number
          default_weight_kg?: number
          default_width_cm?: number
          environment?: string
          last_test_result?: string | null
          last_tested_at?: string | null
          merchant_id?: string
          preferred_courier?: string | null
          preferred_pickup_date?: string | null
          sender_address1?: string | null
          sender_address2?: string | null
          sender_city?: string | null
          sender_company?: string | null
          sender_country?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_postcode?: string | null
          sender_state?: string | null
          updated_at?: string | null
          wallet_balance?: number | null
          wallet_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_easyparcel_config_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_einvoice_config: {
        Row: {
          brn: string | null
          cert_issuer_name: string | null
          cert_p12_base64: string | null
          cert_passphrase: string | null
          cert_serial: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string | null
          description: string | null
          env: string
          merchant_id: string
          msic_code: string | null
          status: string
          tin: string | null
          updated_at: string | null
        }
        Insert: {
          brn?: string | null
          cert_issuer_name?: string | null
          cert_p12_base64?: string | null
          cert_passphrase?: string | null
          cert_serial?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          description?: string | null
          env?: string
          merchant_id: string
          msic_code?: string | null
          status?: string
          tin?: string | null
          updated_at?: string | null
        }
        Update: {
          brn?: string | null
          cert_issuer_name?: string | null
          cert_p12_base64?: string | null
          cert_passphrase?: string | null
          cert_serial?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          description?: string | null
          env?: string
          merchant_id?: string
          msic_code?: string | null
          status?: string
          tin?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_einvoice_config_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_lalamove_config: {
        Row: {
          api_key: string | null
          api_secret: string | null
          auto_book_on_ready: boolean
          created_at: string | null
          default_priority_fee_rm: number
          default_service_type: string
          environment: string
          last_test_result: string | null
          last_tested_at: string | null
          market: string
          merchant_id: string
          pickup_address_text: string | null
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_instructions: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          updated_at: string | null
          webhook_verified: boolean
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          auto_book_on_ready?: boolean
          created_at?: string | null
          default_priority_fee_rm?: number
          default_service_type?: string
          environment?: string
          last_test_result?: string | null
          last_tested_at?: string | null
          market?: string
          merchant_id: string
          pickup_address_text?: string | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_instructions?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          updated_at?: string | null
          webhook_verified?: boolean
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          auto_book_on_ready?: boolean
          created_at?: string | null
          default_priority_fee_rm?: number
          default_service_type?: string
          environment?: string
          last_test_result?: string | null
          last_tested_at?: string | null
          market?: string
          merchant_id?: string
          pickup_address_text?: string | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_instructions?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          updated_at?: string | null
          webhook_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "merchant_lalamove_config_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_razorpay_config: {
        Row: {
          created_at: string
          key_id: string
          key_secret: string
          merchant_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          key_id: string
          key_secret: string
          merchant_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          key_id?: string
          key_secret?: string
          merchant_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_razorpay_config_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          average_rating: number | null
          banner_url: string | null
          billplz_collection_id: string | null
          city: string | null
          country: string
          created_at: string
          delivery_radius_km: number | null
          description: string | null
          email: string | null
          id: string
          industry: string
          lat: number | null
          lng: number | null
          location: unknown
          logo_url: string | null
          metadata: Json | null
          min_order_amount: number | null
          operating_hours: Json | null
          owner_id: string
          phone: string | null
          postcode: string
          razorpay_account_id: string | null
          review_count: number | null
          state: string | null
          status: Database["public"]["Enums"]["merchant_status"]
          store_name: string
          store_slug: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          average_rating?: number | null
          banner_url?: string | null
          billplz_collection_id?: string | null
          city?: string | null
          country?: string
          created_at?: string
          delivery_radius_km?: number | null
          description?: string | null
          email?: string | null
          id?: string
          industry: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          logo_url?: string | null
          metadata?: Json | null
          min_order_amount?: number | null
          operating_hours?: Json | null
          owner_id: string
          phone?: string | null
          postcode: string
          razorpay_account_id?: string | null
          review_count?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["merchant_status"]
          store_name: string
          store_slug: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          average_rating?: number | null
          banner_url?: string | null
          billplz_collection_id?: string | null
          city?: string | null
          country?: string
          created_at?: string
          delivery_radius_km?: number | null
          description?: string | null
          email?: string | null
          id?: string
          industry?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          logo_url?: string | null
          metadata?: Json | null
          min_order_amount?: number | null
          operating_hours?: Json | null
          owner_id?: string
          phone?: string | null
          postcode?: string
          razorpay_account_id?: string | null
          review_count?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["merchant_status"]
          store_name?: string
          store_slug?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          is_read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          metadata: Json
          provider: string
          state: string
          tenant_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          provider: string
          state: string
          tenant_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          provider?: string
          state?: string
          tenant_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          is_public: boolean | null
          merchant_id: string | null
          order_id: string | null
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_public?: boolean | null
          merchant_id?: string | null
          order_id?: string | null
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_public?: boolean | null
          merchant_id?: string | null
          order_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_email: string | null
          buyer_name: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          coupon_code: string | null
          coupon_discount: number | null
          created_at: string
          customer_id: string
          customer_note: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          delivery_provider:
            | Database["public"]["Enums"]["delivery_provider"]
            | null
          delivery_quote_id: string | null
          delivery_service_id: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          delivery_tracking_id: string | null
          delivery_tracking_url: string | null
          delivery_type: string | null
          discount_amount: number
          dispatched_at: string | null
          driver_assigned_at: string | null
          driver_name: string | null
          driver_phone: string | null
          driver_plate: string | null
          easyparcel_order_no: string | null
          estimated_delivery: string | null
          exception_flag: string | null
          exception_flagged_at: string | null
          id: string
          is_refunded: boolean | null
          lalamove_cancel_reason: string | null
          lalamove_order_id: string | null
          lalamove_retry_count: number | null
          last_driver_lat: number | null
          last_driver_lng: number | null
          last_driver_update_at: string | null
          merchant_id: string
          merchant_note: string | null
          order_number: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_address: Json | null
          platform_fee: number | null
          points_discount: number | null
          points_earned: number | null
          points_redeemed: number | null
          preparing_at: string | null
          priority_fee_added: number | null
          ready_at: string | null
          refund_id: string | null
          refunded_amount: number | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          einvoice_status: Database["public"]["Enums"]["einvoice_status"]
          einvoice_details: Json | null
        }
        Insert: {
          buyer_email?: string | null
          buyer_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string
          customer_id: string
          customer_note?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          delivery_fee?: number
          delivery_provider?:
            | Database["public"]["Enums"]["delivery_provider"]
            | null
          delivery_quote_id?: string | null
          delivery_service_id?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          delivery_tracking_id?: string | null
          delivery_tracking_url?: string | null
          delivery_type?: string | null
          discount_amount?: number
          dispatched_at?: string | null
          driver_assigned_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          driver_plate?: string | null
          easyparcel_order_no?: string | null
          estimated_delivery?: string | null
          exception_flag?: string | null
          exception_flagged_at?: string | null
          id?: string
          is_refunded?: boolean | null
          lalamove_cancel_reason?: string | null
          lalamove_order_id?: string | null
          lalamove_retry_count?: number | null
          last_driver_lat?: number | null
          last_driver_lng?: number | null
          last_driver_update_at?: string | null
          merchant_id: string
          merchant_note?: string | null
          order_number?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address?: Json | null
          platform_fee?: number | null
          points_discount?: number | null
          points_earned?: number | null
          points_redeemed?: number | null
          preparing_at?: string | null
          priority_fee_added?: number | null
          ready_at?: string | null
          refund_id?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          einvoice_status?: Database["public"]["Enums"]["einvoice_status"]
          einvoice_details?: Json | null
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string
          customer_id?: string
          customer_note?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          delivery_fee?: number
          delivery_provider?:
            | Database["public"]["Enums"]["delivery_provider"]
            | null
          delivery_quote_id?: string | null
          delivery_service_id?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          delivery_tracking_id?: string | null
          delivery_tracking_url?: string | null
          delivery_type?: string | null
          discount_amount?: number
          dispatched_at?: string | null
          driver_assigned_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          driver_plate?: string | null
          easyparcel_order_no?: string | null
          estimated_delivery?: string | null
          exception_flag?: string | null
          exception_flagged_at?: string | null
          id?: string
          is_refunded?: boolean | null
          lalamove_cancel_reason?: string | null
          lalamove_order_id?: string | null
          lalamove_retry_count?: number | null
          last_driver_lat?: number | null
          last_driver_lng?: number | null
          last_driver_update_at?: string | null
          merchant_id?: string
          merchant_note?: string | null
          order_number?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address?: Json | null
          platform_fee?: number | null
          points_discount?: number | null
          points_earned?: number | null
          points_redeemed?: number | null
          preparing_at?: string | null
          priority_fee_added?: number | null
          ready_at?: string | null
          refund_id?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          einvoice_status?: Database["public"]["Enums"]["einvoice_status"]
          einvoice_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string | null
          event_type: string
          gateway: string
          gateway_ref: string | null
          id: string
          order_id: string | null
          raw_payload: Json | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          gateway: string
          gateway_ref?: string | null
          id?: string
          order_id?: string | null
          raw_payload?: Json | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          gateway?: string
          gateway_ref?: string | null
          id?: string
          order_id?: string | null
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          order_id: string
          provider: Database["public"]["Enums"]["payment_method"]
          raw_payload: Json | null
          reference: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          order_id: string
          provider: Database["public"]["Enums"]["payment_method"]
          raw_payload?: Json | null
          reference?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          order_id?: string
          provider?: Database["public"]["Enums"]["payment_method"]
          raw_payload?: Json | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      points_transactions: {
        Row: {
          balance_after: number
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          merchant_id: string | null
          metadata: Json | null
          order_id: string | null
          points_delta: number
          type: string
        }
        Insert: {
          balance_after: number
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          merchant_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          points_delta: number
          type: string
        }
        Update: {
          balance_after?: number
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          merchant_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          points_delta?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          name: string
          options: Json
          price_modifier: number | null
          product_id: string
          sku: string | null
          stock_quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          options?: Json
          price_modifier?: number | null
          product_id: string
          sku?: string | null
          stock_quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          options?: Json
          price_modifier?: number | null
          product_id?: string
          sku?: string | null
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          description: string | null
          gtin: string | null
          id: string
          images: string[] | null
          is_featured: boolean | null
          low_stock_alert: number | null
          merchant_id: string
          metadata: Json | null
          mpn: string | null
          name: string
          price: number
          provider_meta: Json | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          track_inventory: boolean | null
          updated_at: string
          variants: Json | null
          weight_grams: number | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          gtin?: string | null
          id?: string
          images?: string[] | null
          is_featured?: boolean | null
          low_stock_alert?: number | null
          merchant_id: string
          metadata?: Json | null
          mpn?: string | null
          name: string
          price: number
          provider_meta?: Json | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          track_inventory?: boolean | null
          updated_at?: string
          variants?: Json | null
          weight_grams?: number | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          gtin?: string | null
          id?: string
          images?: string[] | null
          is_featured?: boolean | null
          low_stock_alert?: number | null
          merchant_id?: string
          metadata?: Json | null
          mpn?: string | null
          name?: string
          price?: number
          provider_meta?: Json | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          track_inventory?: boolean | null
          updated_at?: string
          variants?: Json | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          device_token: string | null
          expo_push_token: string | null
          full_name: string | null
          id: string
          is_verified: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          device_token?: string | null
          expo_push_token?: string | null
          full_name?: string | null
          id: string
          is_verified?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          device_token?: string | null
          expo_push_token?: string | null
          full_name?: string | null
          id?: string
          is_verified?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_discount: number | null
          max_uses: number | null
          merchant_id: string | null
          min_order: number | null
          used_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          max_uses?: number | null
          merchant_id?: string | null
          min_order?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          max_uses?: number | null
          merchant_id?: string | null
          min_order?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_logs: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          response_payload: Json | null
          status: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          response_payload?: Json | null
          status?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          response_payload?: Json | null
          status?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          id: string
          merchant_id: string | null
          notes: string | null
          order_id: string | null
          processed_at: string | null
          reason: string | null
          refund_method: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          id?: string
          merchant_id?: string | null
          notes?: string | null
          order_id?: string | null
          processed_at?: string | null
          reason?: string | null
          refund_method?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          id?: string
          merchant_id?: string | null
          notes?: string | null
          order_id?: string | null
          processed_at?: string | null
          reason?: string | null
          refund_method?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          id: string
          order_id: string | null
          processed_at: string | null
          provider: string
        }
        Insert: {
          event_id: string
          id?: string
          order_id?: string | null
          processed_at?: string | null
          provider: string
        }
        Update: {
          event_id?: string
          id?: string
          order_id?: string | null
          processed_at?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      auth_merchant_id: { Args: never; Returns: string }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      claim_marketplace_sync_jobs: {
        Args: { p_limit?: number; p_lock_token: string }
        Returns: {
          attempt_count: number
          created_at: string
          finished_at: string | null
          id: string
          job_type: Database["public"]["Enums"]["sync_job_type"]
          last_error_code: string | null
          last_error_message: string | null
          last_error_payload: Json | null
          lock_token: string | null
          locked_at: string | null
          marketplace_account_id: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          priority: number
          provider: Database["public"]["Enums"]["marketplace_provider"]
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "marketplace_sync_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_order_v2: {
        Args: {
          p_customer_id: string
          p_delivery_address: Json
          p_delivery_fee: number
          p_delivery_provider: string
          p_delivery_type: string
          p_discount_amount: number
          p_items: Json
          p_merchant_id: string
          p_order_number: string
          p_payment_method: string
          p_subtotal: number
          p_total_amount: number
          p_einvoice_status?: string
          p_einvoice_details?: Json
        }
        Returns: string
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      flag_stuck_driver_assignments: { Args: never; Returns: undefined }
      flag_unresponsive_drivers: { Args: never; Returns: undefined }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_cart_abandonment_stats: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          abandoned_carts: number
          abandonment_rate: number
          converted_carts: number
          lost_revenue: number
          total_carts: number
        }[]
      }
      get_coupon_usage: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          avg_order_value: number
          coupon_code: string
          total_discount: number
          total_order_value: number
          usage_count: number
        }[]
      }
      get_customer_kpi_list: {
        Args: {
          p_end: string
          p_limit?: number
          p_merchant_id: string
          p_start: string
        }
        Returns: {
          aov_in_period: number
          coupon_uses: number
          customer_id: string
          email: string
          full_name: string
          last_order_date: string
          lifetime_orders: number
          lifetime_value: number
          orders_in_period: number
          phone: string
          registered_at: string
          revenue_in_period: number
        }[]
      }
      get_customer_overview_stats: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          avg_days_between: number
          avg_ltv: number
          avg_orders_per_cust: number
          churned_customers: number
          new_customers: number
          retention_rate: number
          returning_customers: number
          total_customers: number
        }[]
      }
      get_customer_segments_rfm: {
        Args: { p_merchant_id: string }
        Returns: {
          customer_id: string
          email: string
          f_score: number
          frequency: number
          full_name: string
          last_order_at: string
          m_score: number
          monetary: number
          r_score: number
          recency_days: number
          rfm_score: string
          segment: string
        }[]
      }
      get_daily_revenue: {
        Args: { p_days: number; p_merchant_id: string }
        Returns: {
          date: string
          revenue: number
        }[]
      }
      get_daily_revenue_range: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          date: string
          orders: number
          revenue: number
          shipping: number
        }[]
      }
      get_new_customer_trend: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          date: string
          new_count: number
          total_count: number
        }[]
      }
      get_order_status_breakdown: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          order_count: number
          status: string
          total_revenue: number
        }[]
      }
      get_purchase_patterns: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          avg_revenue: number
          day_of_week: number
          hour_of_day: number
          order_count: number
        }[]
      }
      get_refunds_summary: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          approved_count: number
          pending_count: number
          total_refunded_rm: number
          total_refunds_count: number
        }[]
      }
      get_retention_cohorts: {
        Args: { p_merchant_id: string; p_months?: number }
        Returns: {
          active_count: number
          cohort_month: string
          cohort_size: number
          period_offset: number
          retention_pct: number
        }[]
      }
      get_revenue_summary: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          avg_order_value: number
          net_revenue: number
          total_discounts: number
          total_orders: number
          total_refunds: number
          total_revenue: number
          total_shipping: number
          total_tax: number
          unique_customers: number
        }[]
      }
      get_sales_by_region: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          order_count: number
          region: string
          total_revenue: number
          total_shipping: number
        }[]
      }
      get_satisfaction_summary: {
        Args: { p_end: string; p_merchant_id: string; p_start: string }
        Returns: {
          avg_rating: number
          five_star: number
          four_star: number
          nps_score: number
          one_star: number
          three_star: number
          total_reviews: number
          two_star: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      is_merchant_owner: { Args: { m_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      poll_active_lalamove_orders: { Args: never; Returns: undefined }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      account_status:
        | "pending"
        | "connected"
        | "disconnected"
        | "expired"
        | "error"
      delivery_provider:
        | "lalamove"
        | "grab_express"
        | "easyparcel"
        | "self_pickup"
        | "merchant_delivery"
      delivery_status:
        | "not_requested"
        | "pending"
        | "finding_driver"
        | "driver_assigned"
        | "picked_up"
        | "in_transit"
        | "delivered"
        | "failed"
        | "returned"
      diagnostic_scope: "account" | "product"
      diagnostic_severity: "critical" | "error" | "warning" | "suggestion"
      event_processing_status:
        | "received"
        | "processing"
        | "succeeded"
        | "failed"
        | "duplicate"
      marketplace_provider: "shopee" | "tiktok" | "lazada" | "google_merchant"
      merchant_status: "pending_review" | "active" | "suspended" | "deactivated"
      order_status:
        | "pending"
        | "paid"
        | "confirmed"
        | "preparing"
        | "ready_for_pickup"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "refunded"
        | "ready_to_ship"
        | "returned"
        | "failed"
      payment_method: "razorpay" | "billplz" | "cod"
      payment_status:
        | "unpaid"
        | "pending_verification"
        | "paid"
        | "failed"
        | "refunded"
      product_mapping_status:
        | "pending"
        | "mapped"
        | "published"
        | "failed"
        | "needs_attention"
        | "deleted"
      product_status: "active" | "inactive" | "out_of_stock" | "deleted"
      sync_job_status: "queued" | "processing" | "succeeded" | "failed" | "dead"
      einvoice_status: "pending_buyer_request" | "needs_einvoice_now" | "converted_to_individual" | "sent_to_consolidated_batch"
      sync_job_type:
        | "connect_account"
        | "refresh_credentials"
        | "validate_catalog"
        | "sync_products"
        | "sync_orders"
        | "sync_inventory"
        | "sync_fulfillment"
        | "sync_diagnostics"
        | "update_availability"
        | "delete_product"
        | "reconcile_state"
        | "replay_event"
        | "deauthorize_account"
      user_role: "customer" | "merchant" | "admin"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      account_status: [
        "pending",
        "connected",
        "disconnected",
        "expired",
        "error",
      ],
      delivery_provider: [
        "lalamove",
        "grab_express",
        "easyparcel",
        "self_pickup",
        "merchant_delivery",
      ],
      delivery_status: [
        "not_requested",
        "pending",
        "finding_driver",
        "driver_assigned",
        "picked_up",
        "in_transit",
        "delivered",
        "failed",
        "returned",
      ],
      diagnostic_scope: ["account", "product"],
      diagnostic_severity: ["critical", "error", "warning", "suggestion"],
      event_processing_status: [
        "received",
        "processing",
        "succeeded",
        "failed",
        "duplicate",
      ],
      marketplace_provider: ["shopee", "tiktok", "lazada", "google_merchant"],
      merchant_status: ["pending_review", "active", "suspended", "deactivated"],
      order_status: [
        "pending",
        "paid",
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",
        "ready_to_ship",
        "returned",
        "failed",
      ],
      payment_method: ["razorpay", "billplz", "cod"],
      payment_status: [
        "unpaid",
        "pending_verification",
        "paid",
        "failed",
        "refunded",
      ],
      product_mapping_status: [
        "pending",
        "mapped",
        "published",
        "failed",
        "needs_attention",
        "deleted",
      ],
      product_status: ["active", "inactive", "out_of_stock", "deleted"],
      sync_job_status: ["queued", "processing", "succeeded", "failed", "dead"],
      sync_job_type: [
        "connect_account",
        "refresh_credentials",
        "validate_catalog",
        "sync_products",
        "sync_orders",
        "sync_inventory",
        "sync_fulfillment",
        "sync_diagnostics",
        "update_availability",
        "delete_product",
        "reconcile_state",
        "replay_event",
        "deauthorize_account",
      ],
      user_role: ["customer", "merchant", "admin"],
    },
  },
} as const
