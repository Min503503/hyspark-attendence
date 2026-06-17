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
          venue_name: string | null
          venue_map_url: string | null
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
          venue_name?: string | null
          venue_map_url?: string | null
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
          venue_name?: string | null
          venue_map_url?: string | null
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
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
