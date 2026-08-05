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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_method: string
          checked_in_at: string | null
          code_verified: boolean
          created_at: string
          demerit_points: number
          exception_category: string | null
          exception_note: string | null
          id: string
          location_verified: boolean
          member_id: string
          member_name: string
          override_at: string | null
          override_by: string | null
          override_reason: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_method?: string
          checked_in_at?: string | null
          code_verified?: boolean
          created_at?: string
          demerit_points?: number
          exception_category?: string | null
          exception_note?: string | null
          id?: string
          location_verified?: boolean
          member_id: string
          member_name: string
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          session_id: string
          status: string
          updated_at?: string
        }
        Update: {
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_method?: string
          checked_in_at?: string | null
          code_verified?: boolean
          created_at?: string
          demerit_points?: number
          exception_category?: string | null
          exception_note?: string | null
          id?: string
          location_verified?: boolean
          member_id?: string
          member_name?: string
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_daily_responses: {
        Row: {
          attended: boolean
          camp_id: string
          demerit_credit: number
          duration_minutes: number
          from_time: string
          id: string
          profile_id: string
          response_date: string
          submitted_at: string
          time_slots: string[] | null
          to_time: string
        }
        Insert: {
          attended?: boolean
          camp_id: string
          demerit_credit?: number
          duration_minutes: number
          from_time: string
          id?: string
          profile_id: string
          response_date: string
          submitted_at?: string
          time_slots?: string[] | null
          to_time: string
        }
        Update: {
          attended?: boolean
          camp_id?: string
          demerit_credit?: number
          duration_minutes?: number
          from_time?: string
          id?: string
          profile_id?: string
          response_date?: string
          submitted_at?: string
          time_slots?: string[] | null
          to_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_daily_responses_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camp_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_daily_responses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_settings: {
        Row: {
          created_at: string
          daily_close_time: string
          daily_open_time: string
          enabled: boolean
          end_date: string
          id: string
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_close_time?: string
          daily_open_time?: string
          enabled?: boolean
          end_date: string
          id?: string
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_close_time?: string
          daily_open_time?: string
          enabled?: boolean
          end_date?: string
          id?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cohorts: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          season_label: string | null
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          season_label?: string | null
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          season_label?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
      email_automation_rules: {
        Row: {
          audience: string
          body_template: string
          created_at: string
          enabled: boolean
          id: string
          name: string
          offset_minutes: number
          require_networking: boolean
          sort_order: number
          subject_template: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body_template: string
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          offset_minutes?: number
          require_networking?: boolean
          sort_order?: number
          subject_template: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body_template?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          offset_minutes?: number
          require_networking?: boolean
          sort_order?: number
          subject_template?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_automation_runs: {
        Row: {
          checked_at: string
          closed: number
          error_message: string | null
          failed: number
          id: string
          opened: number
          raw_response: Json | null
          rules_checked: number
          sent: number
          skipped: number
          trigger_source: string
        }
        Insert: {
          checked_at?: string
          closed?: number
          error_message?: string | null
          failed?: number
          id?: string
          opened?: number
          raw_response?: Json | null
          rules_checked?: number
          sent?: number
          skipped?: number
          trigger_source?: string
        }
        Update: {
          checked_at?: string
          closed?: number
          error_message?: string | null
          failed?: number
          id?: string
          opened?: number
          raw_response?: Json | null
          rules_checked?: number
          sent?: number
          skipped?: number
          trigger_source?: string
        }
        Relationships: []
      }
      email_send_logs: {
        Row: {
          dedupe_key: string
          email: string
          error_message: string | null
          id: string
          message_id: string | null
          profile_id: string | null
          rule_id: string | null
          sent_at: string
          session_id: string | null
          status: string
          subject: string
        }
        Insert: {
          dedupe_key: string
          email: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          profile_id?: string | null
          rule_id?: string | null
          sent_at?: string
          session_id?: string | null
          status: string
          subject: string
        }
        Update: {
          dedupe_key?: string
          email?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          profile_id?: string | null
          rule_id?: string | null
          sent_at?: string
          session_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_portal_tokens: {
        Row: {
          created_at: string
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          token?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_portal_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cohort_label: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          member_code: string | null
          phone: string | null
          role: string
          status: string
          updated_at: string
          mail_delivery_status: string
          bounce_count: number
          last_bounce_at: string | null
          last_bounce_reason: string | null
        }
        Insert: {
          cohort_label?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          member_code?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
          mail_delivery_status?: string
          bounce_count?: number
          last_bounce_at?: string | null
          last_bounce_reason?: string | null
        }
        Update: {
          cohort_label?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          member_code?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
          mail_delivery_status?: string
          bounce_count?: number
          last_bounce_at?: string | null
          last_bounce_reason?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          attendance_code: string | null
          attendance_code_expires_at: string | null
          attendance_code_issued_at: string | null
          attendance_code_status: string
          attendance_deadline_minutes: number
          attendance_rate: number | null
          check_in_open_minutes: number
          cohort_id: string | null
          created_at: string
          end_at: string | null
          geofence_radius_m: number
          id: string
          late_deadline_minutes: number
          notes: string | null
          qr_token: string
          session_code: string
          start_at: string
          status: string
          title: string
          updated_at: string
          venue_lat: number | null
          venue_lng: number | null
          venue_map_url: string | null
          venue_name: string | null
        }
        Insert: {
          attendance_code?: string | null
          attendance_code_expires_at?: string | null
          attendance_code_issued_at?: string | null
          attendance_code_status?: string
          attendance_deadline_minutes?: number
          attendance_rate?: number | null
          check_in_open_minutes?: number
          cohort_id?: string | null
          created_at?: string
          end_at?: string | null
          geofence_radius_m?: number
          id?: string
          late_deadline_minutes?: number
          notes?: string | null
          qr_token?: string
          session_code?: string
          start_at: string
          status?: string
          title: string
          updated_at?: string
          venue_lat?: number | null
          venue_lng?: number | null
          venue_map_url?: string | null
          venue_name?: string | null
        }
        Update: {
          attendance_code?: string | null
          attendance_code_expires_at?: string | null
          attendance_code_issued_at?: string | null
          attendance_code_status?: string
          attendance_deadline_minutes?: number
          attendance_rate?: number | null
          check_in_open_minutes?: number
          cohort_id?: string | null
          created_at?: string
          end_at?: string | null
          geofence_radius_m?: number
          id?: string
          late_deadline_minutes?: number
          notes?: string | null
          qr_token?: string
          session_code?: string
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          venue_lat?: number | null
          venue_lng?: number | null
          venue_map_url?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_camp_settings: {
        Args: never
        Returns: {
          created_at: string
          daily_close_time: string
          daily_open_time: string
          enabled: boolean
          end_date: string
          id: string
          start_date: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "camp_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_camp_survey_context: { Args: { p_profile_id: string }; Returns: Json }
      get_member_camp_responses: {
        Args: { p_profile_id: string }
        Returns: {
          attended: boolean
          demerit_credit: number
          duration_minutes: number
          from_time: string
          id: string
          response_date: string
          time_slots: string[]
          to_time: string
        }[]
      }
      get_or_create_member_portal_token: {
        Args: { p_profile_id: string }
        Returns: string
      }
      hyspark_camp_demerit_credit: {
        Args: { p_duration_minutes: number }
        Returns: number
      }
      hyspark_camp_response_json: {
        Args: {
          p_resp: Database["public"]["Tables"]["camp_daily_responses"]["Row"]
        }
        Returns: Json
      }
      hyspark_demerit_points: { Args: { p_status: string }; Returns: number }
      hyspark_kst_date: { Args: { p_ts?: string }; Returns: string }
      invoke_auto_open_sessions_edge: { Args: never; Returns: undefined }
      invoke_camp_survey_reminder_edge: { Args: never; Returns: undefined }
      maybe_open_due_sessions: { Args: never; Returns: number }
      member_check_in: {
        Args: { p_code: string; p_member_id: string; p_session_id: string }
        Returns: Json
      }
      member_submit_absence: {
        Args: {
          p_category?: string
          p_member_id: string
          p_note?: string
          p_session_id: string
          p_status: string
        }
        Returns: Json
      }
      resolve_member_portal_token: { Args: { p_token: string }; Returns: Json }
      submit_camp_daily_response: {
        Args: {
          p_attended?: boolean
          p_from_time: string
          p_profile_id: string
          p_response_date?: string
          p_time_slots?: string[]
          p_to_time: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
