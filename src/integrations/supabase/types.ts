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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acai_categories: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      acai_category_sizes: {
        Row: {
          base_price: number
          category_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acai_category_sizes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      acai_size_option_groups: {
        Row: {
          created_at: string
          description: string | null
          extra_price_per_item: number
          free_quantity: number
          id: string
          max_selections: number
          min_selections: number
          name: string
          size_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_price_per_item?: number
          free_quantity?: number
          id?: string
          max_selections?: number
          min_selections?: number
          name: string
          size_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_price_per_item?: number
          free_quantity?: number
          id?: string
          max_selections?: number
          min_selections?: number
          name?: string
          size_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acai_size_option_groups_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "acai_category_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      acai_size_options: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          is_available: boolean
          name: string
          price_modifier: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          is_available?: boolean
          name: string
          price_modifier?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          is_available?: boolean
          name?: string
          price_modifier?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "acai_size_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "acai_size_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action_type: string
          company_id: string
          created_at: string
          description: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          company_id: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          company_id?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          category_type: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category_type?: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category_type?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      category_day_periods: {
        Row: {
          category_id: string
          created_at: string
          day_period_id: string
          id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          day_period_id: string
          id?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          day_period_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_day_periods_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_day_periods_day_period_id_fkey"
            columns: ["day_period_id"]
            isOneToOne: false
            referencedRelation: "day_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_slot_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          slot_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          slot_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_slot_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_slot_products_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "combo_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_slots: {
        Row: {
          category_id: string | null
          combo_id: string
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          max_quantity: number
          min_quantity: number
          name: string
          sort_order: number
        }
        Insert: {
          category_id?: string | null
          combo_id: string
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          max_quantity?: number
          min_quantity?: number
          name: string
          sort_order?: number
        }
        Update: {
          category_id?: string | null
          combo_id?: string
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          max_quantity?: number
          min_quantity?: number
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_slots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_slots_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          availability_info: string | null
          combo_mode: string
          company_id: string
          created_at: string
          discount_percent: number | null
          id: string
          price_type: string
          product_id: string
          show_discount_badge: boolean | null
          updated_at: string
          urgency_message: string | null
        }
        Insert: {
          availability_info?: string | null
          combo_mode?: string
          company_id: string
          created_at?: string
          discount_percent?: number | null
          id?: string
          price_type?: string
          product_id: string
          show_discount_badge?: boolean | null
          updated_at?: string
          urgency_message?: string | null
        }
        Update: {
          availability_info?: string | null
          combo_mode?: string
          company_id?: string
          created_at?: string
          discount_percent?: number | null
          id?: string
          price_type?: string
          product_id?: string
          show_discount_badge?: boolean | null
          updated_at?: string
          urgency_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          auto_print_kitchen: boolean
          auto_print_mode: string
          city: string | null
          cnpj: string | null
          cover_url: string | null
          created_at: string
          delivery_fee: number | null
          description: string | null
          email: string | null
          id: string
          inscricao_estadual: string | null
          is_open: boolean | null
          kds_token: string | null
          logo_url: string | null
          max_delivery_radius_km: number | null
          menu_published: boolean
          min_order_value: number | null
          monthly_order_count: number | null
          monthly_revenue: number | null
          name: string
          niche: string | null
          opening_hours: Json | null
          order_count_reset_date: string | null
          owner_id: string
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          primary_color: string | null
          razao_social: string | null
          revenue_reset_date: string | null
          secondary_color: string | null
          show_floating_orders_button: boolean
          show_pix_key_on_menu: boolean | null
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          stripe_customer_id: string | null
          subscription_end_date: string | null
          subscription_plan: string | null
          subscription_status: string | null
          updated_at: string
          whatsapp_notifications_enabled: boolean | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          auto_print_kitchen?: boolean
          auto_print_mode?: string
          city?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_fee?: number | null
          description?: string | null
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          is_open?: boolean | null
          kds_token?: string | null
          logo_url?: string | null
          max_delivery_radius_km?: number | null
          menu_published?: boolean
          min_order_value?: number | null
          monthly_order_count?: number | null
          monthly_revenue?: number | null
          name: string
          niche?: string | null
          opening_hours?: Json | null
          order_count_reset_date?: string | null
          owner_id: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          primary_color?: string | null
          razao_social?: string | null
          revenue_reset_date?: string | null
          secondary_color?: string | null
          show_floating_orders_button?: boolean
          show_pix_key_on_menu?: boolean | null
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          stripe_customer_id?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
          whatsapp_notifications_enabled?: boolean | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          auto_print_kitchen?: boolean
          auto_print_mode?: string
          city?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_fee?: number | null
          description?: string | null
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          is_open?: boolean | null
          kds_token?: string | null
          logo_url?: string | null
          max_delivery_radius_km?: number | null
          menu_published?: boolean
          min_order_value?: number | null
          monthly_order_count?: number | null
          monthly_revenue?: number | null
          name?: string
          niche?: string | null
          opening_hours?: Json | null
          order_count_reset_date?: string | null
          owner_id?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          primary_color?: string | null
          razao_social?: string | null
          revenue_reset_date?: string | null
          secondary_color?: string | null
          show_floating_orders_button?: boolean
          show_pix_key_on_menu?: boolean | null
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          stripe_customer_id?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
          whatsapp_notifications_enabled?: boolean | null
          zip_code?: string | null
        }
        Relationships: []
      }
      company_features: {
        Row: {
          company_id: string
          created_at: string | null
          expires_at: string | null
          feature_id: string
          id: string
          is_active: boolean | null
          payment_reference: string | null
          price_paid: number
          price_type: string
          purchased_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          expires_at?: string | null
          feature_id: string
          id?: string
          is_active?: boolean | null
          payment_reference?: string | null
          price_paid?: number
          price_type: string
          purchased_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          expires_at?: string | null
          feature_id?: string
          id?: string
          is_active?: boolean | null
          payment_reference?: string | null
          price_paid?: number
          price_type?: string
          purchased_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "system_features"
            referencedColumns: ["id"]
          },
        ]
      }
      company_payment_settings: {
        Row: {
          active_payment_gateway: string | null
          card_enabled: boolean | null
          company_id: string
          created_at: string
          id: string
          mercadopago_access_token: string | null
          mercadopago_account_email: string | null
          mercadopago_enabled: boolean | null
          mercadopago_public_key: string | null
          mercadopago_verified: boolean | null
          mercadopago_verified_at: string | null
          picpay_account_email: string | null
          picpay_client_id: string | null
          picpay_client_secret: string | null
          picpay_enabled: boolean | null
          picpay_verified: boolean | null
          picpay_verified_at: string | null
          pix_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          active_payment_gateway?: string | null
          card_enabled?: boolean | null
          company_id: string
          created_at?: string
          id?: string
          mercadopago_access_token?: string | null
          mercadopago_account_email?: string | null
          mercadopago_enabled?: boolean | null
          mercadopago_public_key?: string | null
          mercadopago_verified?: boolean | null
          mercadopago_verified_at?: string | null
          picpay_account_email?: string | null
          picpay_client_id?: string | null
          picpay_client_secret?: string | null
          picpay_enabled?: boolean | null
          picpay_verified?: boolean | null
          picpay_verified_at?: string | null
          pix_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          active_payment_gateway?: string | null
          card_enabled?: boolean | null
          company_id?: string
          created_at?: string
          id?: string
          mercadopago_access_token?: string | null
          mercadopago_account_email?: string | null
          mercadopago_enabled?: boolean | null
          mercadopago_public_key?: string | null
          mercadopago_verified?: boolean | null
          mercadopago_verified_at?: string | null
          picpay_account_email?: string | null
          picpay_client_id?: string | null
          picpay_client_secret?: string | null
          picpay_enabled?: boolean | null
          picpay_verified?: boolean | null
          picpay_verified_at?: string | null
          pix_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_payment_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_payment_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      company_review_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          reviews_enabled: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          reviews_enabled?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          reviews_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_review_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_review_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      company_staff: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          company_id: string
          created_at: string
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order_value: number | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_value?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_value?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          customer_id: string | null
          id: string
          is_default: boolean | null
          label: string | null
          neighborhood: string
          number: string
          reference: string | null
          session_id: string | null
          state: string
          street: string
          user_id: string | null
          zip_code: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          neighborhood: string
          number: string
          reference?: string | null
          session_id?: string | null
          state: string
          street: string
          user_id?: string | null
          zip_code: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          neighborhood?: string
          number?: string
          reference?: string | null
          session_id?: string | null
          state?: string
          street?: string
          user_id?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_referral_codes: {
        Row: {
          code: string
          company_id: string
          created_at: string
          customer_id: string
          id: string
          total_discount_given: number | null
          total_referrals: number | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          total_discount_given?: number | null
          total_referrals?: number | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          total_discount_given?: number | null
          total_referrals?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_referral_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_codes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_referral_credits: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          remaining_amount: number
          source_referral_id: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          remaining_amount: number
          source_referral_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          remaining_amount?: number
          source_referral_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_referral_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_credits_source_referral_id_fkey"
            columns: ["source_referral_id"]
            isOneToOne: false
            referencedRelation: "customer_referral_usage"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_referral_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_enabled: boolean | null
          max_uses_per_referred: number | null
          max_uses_per_referrer: number | null
          referred_discount_percent: number | null
          referrer_discount_percent: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          max_uses_per_referred?: number | null
          max_uses_per_referrer?: number | null
          referred_discount_percent?: number | null
          referrer_discount_percent?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          max_uses_per_referred?: number | null
          max_uses_per_referrer?: number | null
          referred_discount_percent?: number | null
          referrer_discount_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_referral_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_referral_usage: {
        Row: {
          company_id: string
          created_at: string
          discount_applied: number | null
          id: string
          order_id: string | null
          referral_code_id: string
          referred_customer_id: string
          referrer_discount_applied: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          discount_applied?: number | null
          id?: string
          order_id?: string | null
          referral_code_id: string
          referred_customer_id: string
          referrer_discount_applied?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          discount_applied?: number | null
          id?: string
          order_id?: string | null
          referral_code_id?: string
          referred_customer_id?: string
          referrer_discount_applied?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_referral_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_usage_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "customer_referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_referral_usage_referred_customer_id_fkey"
            columns: ["referred_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      day_periods: {
        Row: {
          company_id: string
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          company_id: string
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          driver_name: string | null
          driver_phone: string | null
          driver_status: string | null
          email: string | null
          fixed_salary: number | null
          id: string
          is_active: boolean | null
          is_available: boolean | null
          license_plate: string | null
          location_updated_at: string | null
          payment_type: string | null
          pending_earnings: number | null
          per_delivery_fee: number | null
          updated_at: string
          user_id: string | null
          vehicle_type: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          driver_name?: string | null
          driver_phone?: string | null
          driver_status?: string | null
          email?: string | null
          fixed_salary?: number | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          license_plate?: string | null
          location_updated_at?: string | null
          payment_type?: string | null
          pending_earnings?: number | null
          per_delivery_fee?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_type?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          driver_name?: string | null
          driver_phone?: string | null
          driver_status?: string | null
          email?: string | null
          fixed_salary?: number | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          license_plate?: string | null
          location_updated_at?: string | null
          payment_type?: string | null
          pending_earnings?: number | null
          per_delivery_fee?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_deliveries: {
        Row: {
          company_id: string
          created_at: string
          delivered_at: string
          delivery_fee_earned: number
          driver_id: string
          id: string
          order_id: string
          paid_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delivered_at?: string
          delivery_fee_earned?: number
          driver_id: string
          id?: string
          order_id: string
          paid_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delivered_at?: string
          delivery_fee_earned?: number
          driver_id?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          delivery_count: number | null
          description: string | null
          driver_id: string
          id: string
          paid_at: string
          payment_type: string
          reference_period_end: string | null
          reference_period_start: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          delivery_count?: number | null
          description?: string | null
          driver_id: string
          id?: string
          paid_at?: string
          payment_type: string
          reference_period_end?: string | null
          reference_period_start?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          delivery_count?: number | null
          description?: string | null
          driver_id?: string
          id?: string
          paid_at?: string
          payment_type?: string
          reference_period_end?: string | null
          reference_period_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Relationships: []
      }
      favorites: {
        Row: {
          company_id: string
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_pricing: {
        Row: {
          created_at: string | null
          feature_id: string
          id: string
          is_active: boolean | null
          price: number
          price_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          feature_id: string
          id?: string
          is_active?: boolean | null
          price?: number
          price_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          feature_id?: string
          id?: string
          is_active?: boolean | null
          price?: number
          price_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_pricing_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "system_features"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ingredient_units: {
        Row: {
          abbreviation: string
          company_id: string
          conversion_factor: number
          created_at: string
          id: string
          ingredient_id: string
          is_base_unit: boolean
          name: string
        }
        Insert: {
          abbreviation: string
          company_id: string
          conversion_factor?: number
          created_at?: string
          id?: string
          ingredient_id: string
          is_base_unit?: boolean
          name: string
        }
        Update: {
          abbreviation?: string
          company_id?: string
          conversion_factor?: number
          created_at?: string
          id?: string
          ingredient_id?: string
          is_base_unit?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ingredient_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ingredient_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ingredient_units_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ingredients: {
        Row: {
          average_unit_cost: number
          company_id: string
          created_at: string
          current_stock: number
          id: string
          min_stock: number
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          average_unit_cost?: number
          company_id: string
          created_at?: string
          current_stock?: number
          id?: string
          min_stock?: number
          name: string
          unit: string
          updated_at?: string
        }
        Update: {
          average_unit_cost?: number
          company_id?: string
          created_at?: string
          current_stock?: number
          id?: string
          min_stock?: number
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ingredients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ingredients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          ingredient_id: string
          movement_type: string
          note: string | null
          quantity: number
          related_order_id: string | null
          unit_cost: number | null
          unit_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          ingredient_id: string
          movement_type: string
          note?: string | null
          quantity: number
          related_order_id?: string | null
          unit_cost?: number | null
          unit_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          movement_type?: string
          note?: string | null
          quantity?: number
          related_order_id?: string | null
          unit_cost?: number | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredient_units"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_product_ingredients: {
        Row: {
          company_id: string
          created_at: string
          id: string
          ingredient_id: string
          product_id: string
          quantity_per_unit: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          ingredient_id: string
          product_id: string
          quantity_per_unit: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_ingredients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_ingredients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchases: {
        Row: {
          company_id: string
          created_at: string
          id: string
          ingredient_id: string
          purchased_at: string
          quantity: number
          supplier: string | null
          total_cost: number | null
          unit_cost: number
          unit_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          ingredient_id: string
          purchased_at?: string
          quantity: number
          supplier?: string | null
          total_cost?: number | null
          unit_cost: number
          unit_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          purchased_at?: string
          quantity?: number
          supplier?: string | null
          total_cost?: number | null
          unit_cost?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchases_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredient_units"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_draws: {
        Row: {
          company_id: string
          created_at: string
          drawn_at: string
          id: string
          prize_description: string
          total_tickets_in_draw: number | null
          winner_customer_id: string | null
          winner_name: string | null
          winner_phone: string | null
          winner_tickets_count: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          drawn_at?: string
          id?: string
          prize_description: string
          total_tickets_in_draw?: number | null
          winner_customer_id?: string | null
          winner_name?: string | null
          winner_phone?: string | null
          winner_tickets_count?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          drawn_at?: string
          id?: string
          prize_description?: string
          total_tickets_in_draw?: number | null
          winner_customer_id?: string | null
          winner_name?: string | null
          winner_phone?: string | null
          winner_tickets_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lottery_draws_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_draws_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_draws_winner_customer_id_fkey"
            columns: ["winner_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_settings: {
        Row: {
          company_id: string
          created_at: string
          draw_frequency: string | null
          id: string
          is_enabled: boolean | null
          prize_description: string | null
          tickets_per_amount: number | null
          tickets_per_order: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          draw_frequency?: string | null
          id?: string
          is_enabled?: boolean | null
          prize_description?: string | null
          tickets_per_amount?: number | null
          tickets_per_order?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          draw_frequency?: string | null
          id?: string
          is_enabled?: boolean | null
          prize_description?: string | null
          tickets_per_amount?: number | null
          tickets_per_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_tickets: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          is_used: boolean | null
          order_id: string | null
          quantity: number
          used_in_draw_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          is_used?: boolean | null
          order_id?: string | null
          quantity?: number
          used_in_draw_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_used?: boolean | null
          order_id?: string | null
          quantity?: number
          used_in_draw_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lottery_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_tickets_used_in_draw_id_fkey"
            columns: ["used_in_draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_company_settings: {
        Row: {
          ambiente: string | null
          certificate_expires_at: string | null
          certificate_password: string | null
          certificate_path: string | null
          company_id: string
          created_at: string | null
          csc_id: string | null
          csc_token: string | null
          id: string
          is_configured: boolean | null
          numero_atual_nfce: number | null
          serie_nfce: number | null
          updated_at: string | null
        }
        Insert: {
          ambiente?: string | null
          certificate_expires_at?: string | null
          certificate_password?: string | null
          certificate_path?: string | null
          company_id: string
          created_at?: string | null
          csc_id?: string | null
          csc_token?: string | null
          id?: string
          is_configured?: boolean | null
          numero_atual_nfce?: number | null
          serie_nfce?: number | null
          updated_at?: string | null
        }
        Update: {
          ambiente?: string | null
          certificate_expires_at?: string | null
          certificate_password?: string | null
          certificate_path?: string | null
          company_id?: string
          created_at?: string | null
          csc_id?: string | null
          csc_token?: string | null
          id?: string
          is_configured?: boolean | null
          numero_atual_nfce?: number | null
          serie_nfce?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_global_settings: {
        Row: {
          created_at: string
          environment: string
          focus_nfe_token: string | null
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          focus_nfe_token?: string | null
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          focus_nfe_token?: string | null
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      nfe_invoices: {
        Row: {
          access_key: string | null
          company_id: string
          created_at: string
          error_message: string | null
          focus_nfe_id: string | null
          id: string
          nfe_number: string | null
          order_id: string | null
          pdf_url: string | null
          status: string
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          company_id: string
          created_at?: string
          error_message?: string | null
          focus_nfe_id?: string | null
          id?: string
          nfe_number?: string | null
          order_id?: string | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          company_id?: string
          created_at?: string
          error_message?: string | null
          focus_nfe_id?: string | null
          id?: string
          nfe_number?: string | null
          order_id?: string | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_sound_settings: {
        Row: {
          company_id: string | null
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          sound_key: string
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          sound_key?: string
          updated_at?: string
          user_id: string
          volume?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          sound_key?: string
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          sort_order: number
          step_key: string
          tip: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          step_key: string
          tip?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          step_key?: string
          tip?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          options: Json | null
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          requires_preparation: boolean
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          options?: Json | null
          order_id: string
          product_id: string
          product_name: string
          quantity?: number
          requires_preparation?: boolean
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          options?: Json | null
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          requires_preparation?: boolean
          total_price?: number
          unit_price?: number
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
        ]
      }
      order_offers: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string
          id: string
          order_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_id: string
          id?: string
          order_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          order_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_offers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_public_status: {
        Row: {
          company_id: string
          delivered_at: string | null
          estimated_delivery_time: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          delivered_at?: string | null
          estimated_delivery_time?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          delivered_at?: string | null
          estimated_delivery_time?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_public_status_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_reviews: {
        Row: {
          comment: string | null
          company_id: string
          created_at: string
          delivery_rating: number | null
          food_rating: number | null
          id: string
          order_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          company_id: string
          created_at?: string
          delivery_rating?: number | null
          food_rating?: number | null
          id?: string
          order_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          company_id?: string
          created_at?: string
          delivery_rating?: number | null
          food_rating?: number | null
          id?: string
          order_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          change_for: number | null
          company_id: string
          coupon_id: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_driver_id: string | null
          delivery_fee: number
          discount_amount: number | null
          estimated_delivery_time: string | null
          id: string
          needs_change: boolean | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          queue_position: number | null
          referral_code_id: string | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          subtotal: number
          table_session_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          change_for?: number | null
          company_id: string
          coupon_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_driver_id?: string | null
          delivery_fee?: number
          discount_amount?: number | null
          estimated_delivery_time?: string | null
          id?: string
          needs_change?: boolean | null
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          queue_position?: number | null
          referral_code_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          subtotal: number
          table_session_id?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          change_for?: number | null
          company_id?: string
          coupon_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_driver_id?: string | null
          delivery_fee?: number
          discount_amount?: number | null
          estimated_delivery_time?: string | null
          id?: string
          needs_change?: boolean | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          queue_position?: number | null
          referral_code_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          subtotal?: number
          table_session_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_driver_id_fkey"
            columns: ["delivery_driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "customer_referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_order_payments: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          mercadopago_payment_id: string | null
          mercadopago_preference_id: string | null
          order_data: Json
          order_id: string | null
          status: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          order_data: Json
          order_id?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          order_data?: Json
          order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_order_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_order_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_categories: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          id: string
          is_pizza_category: boolean
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          id?: string
          is_pizza_category?: boolean
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          is_pizza_category?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pizza_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_category_settings: {
        Row: {
          allow_crust_extra_price_override: boolean | null
          allow_half_half: boolean | null
          allow_repeated_flavors: boolean | null
          category_id: string
          created_at: string
          half_half_discount_percentage: number | null
          half_half_pricing_rule: string | null
          id: string
          max_flavors: number | null
          updated_at: string
        }
        Insert: {
          allow_crust_extra_price_override?: boolean | null
          allow_half_half?: boolean | null
          allow_repeated_flavors?: boolean | null
          category_id: string
          created_at?: string
          half_half_discount_percentage?: number | null
          half_half_pricing_rule?: string | null
          id?: string
          max_flavors?: number | null
          updated_at?: string
        }
        Update: {
          allow_crust_extra_price_override?: boolean | null
          allow_half_half?: boolean | null
          allow_repeated_flavors?: boolean | null
          category_id?: string
          created_at?: string
          half_half_discount_percentage?: number | null
          half_half_pricing_rule?: string | null
          id?: string
          max_flavors?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_category_settings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_category_sizes: {
        Row: {
          base_price: number
          category_id: string
          created_at: string
          id: string
          max_flavors: number
          name: string
          slices: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_id: string
          created_at?: string
          id?: string
          max_flavors?: number
          name: string
          slices?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string
          created_at?: string
          id?: string
          max_flavors?: number
          name?: string
          slices?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_category_sizes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_crust_flavors: {
        Row: {
          active: boolean
          created_at: string
          extra_price: number
          id: string
          name: string
          type_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          extra_price?: number
          id?: string
          name: string
          type_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          extra_price?: number
          id?: string
          name?: string
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_crust_flavors_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "pizza_crust_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_crust_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pizza_dough_types: {
        Row: {
          active: boolean
          created_at: string
          extra_price: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          extra_price?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          extra_price?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pizza_product_crust_flavors: {
        Row: {
          created_at: string
          crust_flavor_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          crust_flavor_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          crust_flavor_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_product_crust_flavors_crust_flavor_id_fkey"
            columns: ["crust_flavor_id"]
            isOneToOne: false
            referencedRelation: "pizza_crust_flavors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_product_crust_flavors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_product_doughs: {
        Row: {
          created_at: string
          dough_type_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          dough_type_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          dough_type_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_product_doughs_dough_type_id_fkey"
            columns: ["dough_type_id"]
            isOneToOne: false
            referencedRelation: "pizza_dough_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_product_doughs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_product_settings: {
        Row: {
          allow_crust_extra_price_override: boolean | null
          allow_half_half: boolean | null
          created_at: string
          half_half_discount_percentage: number | null
          half_half_pricing_rule: string | null
          id: string
          max_flavors: number | null
          product_id: string
          updated_at: string
        }
        Insert: {
          allow_crust_extra_price_override?: boolean | null
          allow_half_half?: boolean | null
          created_at?: string
          half_half_discount_percentage?: number | null
          half_half_pricing_rule?: string | null
          id?: string
          max_flavors?: number | null
          product_id: string
          updated_at?: string
        }
        Update: {
          allow_crust_extra_price_override?: boolean | null
          allow_half_half?: boolean | null
          created_at?: string
          half_half_discount_percentage?: number | null
          half_half_pricing_rule?: string | null
          id?: string
          max_flavors?: number | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_product_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_product_sizes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          size_id: string
          slices: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          size_id: string
          slices: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          size_id?: string
          slices?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_product_sizes_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "pizza_sizes_global"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_settings: {
        Row: {
          allow_crust_extra_price: boolean
          company_id: string
          created_at: string
          enable_addons: boolean
          enable_crust: boolean
          enable_half_half: boolean
          id: string
          max_flavors: number
          updated_at: string
        }
        Insert: {
          allow_crust_extra_price?: boolean
          company_id: string
          created_at?: string
          enable_addons?: boolean
          enable_crust?: boolean
          enable_half_half?: boolean
          id?: string
          max_flavors?: number
          updated_at?: string
        }
        Update: {
          allow_crust_extra_price?: boolean
          company_id?: string
          created_at?: string
          enable_addons?: boolean
          enable_crust?: boolean
          enable_half_half?: boolean
          id?: string
          max_flavors?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_sizes_global: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string | null
          feature_id: string
          id: string
          plan_id: string
        }
        Insert: {
          created_at?: string | null
          feature_id: string
          id?: string
          plan_id: string
        }
        Update: {
          created_at?: string | null
          feature_id?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "system_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          created_at: string
          id: string
          is_removable: boolean
          name: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_removable?: boolean
          name: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_removable?: boolean
          name?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_group_links: {
        Row: {
          created_at: string
          group_id: string
          id: string
          linked_type: string
          product_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          linked_type: string
          product_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          linked_type?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_group_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_group_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string | null
          description: string | null
          extra_unit_price: number
          free_quantity_limit: number
          id: string
          is_required: boolean | null
          kind: Database["public"]["Enums"]["option_group_kind"]
          max_selections: number | null
          min_selections: number | null
          name: string
          product_id: string | null
          scope: Database["public"]["Enums"]["option_group_scope"]
          selection_type: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          extra_unit_price?: number
          free_quantity_limit?: number
          id?: string
          is_required?: boolean | null
          kind?: Database["public"]["Enums"]["option_group_kind"]
          max_selections?: number | null
          min_selections?: number | null
          name: string
          product_id?: string | null
          scope?: Database["public"]["Enums"]["option_group_scope"]
          selection_type?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          extra_unit_price?: number
          free_quantity_limit?: number
          id?: string
          is_required?: boolean | null
          kind?: Database["public"]["Enums"]["option_group_kind"]
          max_selections?: number | null
          min_selections?: number | null
          name?: string
          product_id?: string | null
          scope?: Database["public"]["Enums"]["option_group_scope"]
          selection_type?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          description: string | null
          group_id: string | null
          id: string
          is_available: boolean | null
          is_required: boolean | null
          max_selections: number | null
          name: string
          price_modifier: number | null
          product_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_available?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          name: string
          price_modifier?: number | null
          product_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_available?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          name?: string
          price_modifier?: number | null
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          preparation_time_minutes: number | null
          price: number
          product_type: Database["public"]["Enums"]["product_type"]
          promotional_price: number | null
          requires_preparation: boolean
          sales_count: number | null
          sort_order: number | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          preparation_time_minutes?: number | null
          price: number
          product_type?: Database["public"]["Enums"]["product_type"]
          promotional_price?: number | null
          requires_preparation?: boolean
          sales_count?: number | null
          sort_order?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          preparation_time_minutes?: number | null
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          promotional_price?: number | null
          requires_preparation?: boolean
          sales_count?: number | null
          sort_order?: number | null
          tags?: string[] | null
          updated_at?: string
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
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          product_id: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          product_id?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          product_id?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          company_id: string | null
          created_at: string
          endpoint: string
          id: string
          order_id: string | null
          p256dh: string
          updated_at: string
          user_id: string | null
          user_type: string
        }
        Insert: {
          auth: string
          company_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          order_id?: string | null
          p256dh: string
          updated_at?: string
          user_id?: string | null
          user_type?: string
        }
        Update: {
          auth?: string
          company_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          order_id?: string | null
          p256dh?: string
          updated_at?: string
          user_id?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          commission_percentage: number
          created_at: string
          id: string
          notes: string | null
          referred_company_id: string
          referrer_company_id: string
          valid_until: string | null
        }
        Insert: {
          commission_percentage?: number
          created_at?: string
          id?: string
          notes?: string | null
          referred_company_id: string
          referrer_company_id: string
          valid_until?: string | null
        }
        Update: {
          commission_percentage?: number
          created_at?: string
          id?: string
          notes?: string | null
          referred_company_id?: string
          referrer_company_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_company_id_fkey"
            columns: ["referred_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_company_id_fkey"
            columns: ["referred_company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_company_id_fkey"
            columns: ["referrer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_company_id_fkey"
            columns: ["referrer_company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          can_manage_coupons: boolean
          can_manage_drivers: boolean
          can_manage_inventory: boolean
          can_manage_menu: boolean
          can_manage_orders: boolean
          can_manage_promotions: boolean
          can_manage_reviews: boolean
          can_view_reports: boolean
          company_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_coupons?: boolean
          can_manage_drivers?: boolean
          can_manage_inventory?: boolean
          can_manage_menu?: boolean
          can_manage_orders?: boolean
          can_manage_promotions?: boolean
          can_manage_reviews?: boolean
          can_view_reports?: boolean
          company_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_coupons?: boolean
          can_manage_drivers?: boolean
          can_manage_inventory?: boolean
          can_manage_menu?: boolean
          can_manage_orders?: boolean
          can_manage_promotions?: boolean
          can_manage_reviews?: boolean
          can_view_reports?: boolean
          company_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          key: string
          name: string
          order_limit: number
          price: number
          revenue_limit: number | null
          sort_order: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          order_limit?: number
          price?: number
          revenue_limit?: number | null
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          order_limit?: number
          price?: number
          revenue_limit?: number | null
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_features: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          customer_count: number | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          opened_at: string
          session_token: string | null
          status: string
          table_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_at?: string
          customer_count?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          session_token?: string | null
          status?: string
          table_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          customer_count?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          session_token?: string | null
          status?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          position_x: number | null
          position_y: number | null
          status: string
          table_number: number
          updated_at: string
        }
        Insert: {
          capacity?: number
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          position_x?: number | null
          position_y?: number | null
          status?: string
          table_number: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          position_x?: number | null
          position_y?: number | null
          status?: string
          table_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author_name: string
          author_role: string | null
          company_id: string
          content: string
          created_at: string
          id: string
          is_approved: boolean
          is_featured: boolean
          rating: number
          updated_at: string
        }
        Insert: {
          author_name: string
          author_role?: string | null
          company_id: string
          content: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          rating?: number
          updated_at?: string
        }
        Update: {
          author_name?: string
          author_role?: string | null
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
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
      waiter_calls: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          call_type: string
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
          table_id: string
          table_session_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          call_type?: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          table_id: string
          table_session_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          call_type?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          table_id?: string
          table_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      companies_public: {
        Row: {
          address: string | null
          city: string | null
          cover_url: string | null
          created_at: string | null
          delivery_fee: number | null
          description: string | null
          id: string | null
          is_open: boolean | null
          logo_url: string | null
          max_delivery_radius_km: number | null
          menu_published: boolean | null
          min_order_value: number | null
          name: string | null
          niche: string | null
          opening_hours: Json | null
          primary_color: string | null
          secondary_color: string | null
          slug: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"] | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string | null
          delivery_fee?: number | null
          description?: string | null
          id?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          max_delivery_radius_km?: number | null
          menu_published?: boolean | null
          min_order_value?: number | null
          name?: string | null
          niche?: string | null
          opening_hours?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string | null
          delivery_fee?: number | null
          description?: string | null
          id?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          max_delivery_radius_km?: number | null
          menu_published?: boolean | null
          min_order_value?: number | null
          name?: string | null
          niche?: string | null
          opening_hours?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      landing_stats: {
        Row: {
          avg_rating: number | null
          total_companies: number | null
          total_orders: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_create_customers: { Args: { _user_id: string }; Returns: boolean }
      generate_session_token: { Args: never; Returns: string }
      get_landing_stats: { Args: never; Returns: Json }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_feature_access: {
        Args: { _feature_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_staff_permission: {
        Args: { _company_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      is_driver_for_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_store_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "store_owner"
        | "delivery_driver"
        | "store_staff"
      company_status: "pending" | "approved" | "suspended"
      option_group_kind: "crust" | "addon" | "generic"
      option_group_scope: "global" | "product"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "awaiting_driver"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "queued"
      payment_method:
        | "online"
        | "cash"
        | "card_on_delivery"
        | "pix"
        | "pay_at_counter"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      pizza_price_rule: "higher_price" | "average_price" | "fixed_price"
      product_type: "principal" | "pizza"
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
      app_role: [
        "super_admin",
        "store_owner",
        "delivery_driver",
        "store_staff",
      ],
      company_status: ["pending", "approved", "suspended"],
      option_group_kind: ["crust", "addon", "generic"],
      option_group_scope: ["global", "product"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "awaiting_driver",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "queued",
      ],
      payment_method: [
        "online",
        "cash",
        "card_on_delivery",
        "pix",
        "pay_at_counter",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      pizza_price_rule: ["higher_price", "average_price", "fixed_price"],
      product_type: ["principal", "pizza"],
    },
  },
} as const
