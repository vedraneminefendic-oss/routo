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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          created_at: string | null
          default_deduction_type: string | null
          email: string | null
          has_f_skatt: boolean | null
          id: string
          logo_url: string | null
          org_number: string | null
          phone: string | null
          updated_at: string | null
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          created_at?: string | null
          default_deduction_type?: string | null
          email?: string | null
          has_f_skatt?: boolean | null
          id?: string
          logo_url?: string | null
          org_number?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string | null
          default_deduction_type?: string | null
          email?: string | null
          has_f_skatt?: boolean | null
          id?: string
          logo_url?: string | null
          org_number?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          personnummer: string | null
          phone: string | null
          property_designation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          personnummer?: string | null
          phone?: string | null
          property_designation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          personnummer?: string | null
          phone?: string | null
          property_designation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deduction_limits: {
        Row: {
          created_at: string | null
          deduction_percentage: number
          deduction_type: string
          description: string | null
          id: string
          max_amount_per_year: number
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string | null
          deduction_percentage: number
          deduction_type: string
          description?: string | null
          id?: string
          max_amount_per_year: number
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string | null
          deduction_percentage?: number
          deduction_type?: string
          description?: string | null
          id?: string
          max_amount_per_year?: number
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      equipment_rates: {
        Row: {
          created_at: string
          default_quantity: number
          equipment_type: string
          id: string
          is_rented: boolean
          name: string
          price_per_day: number | null
          price_per_hour: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number
          equipment_type: string
          id?: string
          is_rented?: boolean
          name: string
          price_per_day?: number | null
          price_per_hour?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          equipment_type?: string
          id?: string
          is_rented?: boolean
          name?: string
          price_per_day?: number | null
          price_per_hour?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hourly_rates: {
        Row: {
          created_at: string | null
          id: string
          rate: number
          updated_at: string | null
          user_id: string
          work_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rate: number
          updated_at?: string | null
          user_id: string
          work_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rate?: number
          updated_at?: string | null
          user_id?: string
          work_type?: string
        }
        Relationships: []
      }
      quote_email_logs: {
        Row: {
          clicked_at: string | null
          email_provider_id: string | null
          email_type: string
          id: string
          opened_at: string | null
          quote_id: string
          recipient_email: string
          sent_at: string
        }
        Insert: {
          clicked_at?: string | null
          email_provider_id?: string | null
          email_type: string
          id?: string
          opened_at?: string | null
          quote_id: string
          recipient_email: string
          sent_at?: string
        }
        Update: {
          clicked_at?: string | null
          email_provider_id?: string | null
          email_type?: string
          id?: string
          opened_at?: string | null
          quote_id?: string
          recipient_email?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_email_logs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          paid_at: string | null
          quote_id: string
          status: string
          stripe_payment_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          paid_at?: string | null
          quote_id: string
          status: string
          stripe_payment_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          paid_at?: string | null
          quote_id?: string
          status?: string
          stripe_payment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_recipients: {
        Row: {
          created_at: string | null
          customer_address: string | null
          customer_email: string
          customer_name: string
          customer_personnummer: string | null
          id: string
          ownership_share: number | null
          property_designation: string | null
          quote_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_address?: string | null
          customer_email: string
          customer_name: string
          customer_personnummer?: string | null
          id?: string
          ownership_share?: number | null
          property_designation?: string | null
          quote_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string
          customer_name?: string
          customer_personnummer?: string | null
          id?: string
          ownership_share?: number | null
          property_designation?: string | null
          quote_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_recipients_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_reminders: {
        Row: {
          email_sent: boolean | null
          id: string
          quote_id: string
          reminder_type: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          email_sent?: boolean | null
          id?: string
          quote_id: string
          reminder_type: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          email_sent?: boolean | null
          id?: string
          quote_id?: string
          reminder_type?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_reminders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_signatures: {
        Row: {
          id: string
          ip_address: string
          property_designation: string | null
          quote_id: string
          signed_at: string
          signer_email: string
          signer_name: string
          signer_personnummer: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          ip_address: string
          property_designation?: string | null
          quote_id: string
          signed_at?: string
          signer_email: string
          signer_name: string
          signer_personnummer?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          ip_address?: string
          property_designation?: string | null
          quote_id?: string
          signed_at?: string
          signer_email?: string
          signer_name?: string
          signer_personnummer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_signatures_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          quote_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          quote_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_status_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string
          id: string
          name: string
          template_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          id?: string
          name: string
          template_data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          name?: string
          template_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_views: {
        Row: {
          id: string
          ip_address: string | null
          quote_id: string
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          quote_id: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          quote_id?: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_views_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_id: string | null
          deduction_type: string | null
          description: string
          detail_level: string | null
          edited_quote: Json | null
          generated_quote: Json
          id: string
          is_edited: boolean | null
          locked: boolean | null
          quote_status: Database["public"]["Enums"]["quote_status"] | null
          responded_at: string | null
          sent_at: string | null
          signed_at: string | null
          status: string | null
          title: string
          unique_token: string | null
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          deduction_type?: string | null
          description: string
          detail_level?: string | null
          edited_quote?: Json | null
          generated_quote: Json
          id?: string
          is_edited?: boolean | null
          locked?: boolean | null
          quote_status?: Database["public"]["Enums"]["quote_status"] | null
          responded_at?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string | null
          title: string
          unique_token?: string | null
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          deduction_type?: string | null
          description?: string
          detail_level?: string | null
          edited_quote?: Json | null
          generated_quote?: Json
          id?: string
          is_edited?: boolean | null
          locked?: boolean | null
          quote_status?: Database["public"]["Enums"]["quote_status"] | null
          responded_at?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string | null
          title?: string
          unique_token?: string | null
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          completed: boolean
          created_at: string
          current_step: string | null
          id: string
          skipped: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_step?: string | null
          id?: string
          skipped?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_step?: string | null
          id?: string
          skipped?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_quote_by_token: {
        Args: { token_param: string }
        Returns: {
          company_address: string
          company_email: string
          company_logo_url: string
          company_name: string
          company_phone: string
          created_at: string
          customer_address: string
          customer_email: string
          customer_id: string
          customer_name: string
          customer_personnummer: string
          customer_phone: string
          customer_property_designation: string
          description: string
          edited_quote: Json
          generated_quote: Json
          id: string
          is_edited: boolean
          status: string
          title: string
        }[]
      }
      get_quote_statistics: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          accepted_count: number
          avg_quote_value: number
          completed_count: number
          draft_count: number
          rejected_count: number
          sent_count: number
          total_quotes: number
          total_value: number
          viewed_count: number
        }[]
      }
      get_quotes_time_series: {
        Args: { end_date: string; interval_type?: string; start_date: string }
        Returns: {
          accepted_count: number
          accepted_value: number
          completed_count: number
          draft_count: number
          period_label: string
          period_start: string
          rejected_count: number
          sent_count: number
          total_quotes: number
          total_value: number
          viewed_count: number
        }[]
      }
    }
    Enums: {
      quote_status: "draft" | "sent" | "signed"
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
      quote_status: ["draft", "sent", "signed"],
    },
  },
} as const
