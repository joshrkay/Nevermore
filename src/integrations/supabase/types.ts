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
      advisor_field_reviews: {
        Row: {
          answer_changed_at: string | null
          answer_changed_from: Json | null
          corrected_value: Json | null
          field: string
          has_correction: boolean
          reason: string | null
          review_state: string | null
          session_id: string
          updated_at: string
          updated_by: string
          updated_by_email: string | null
        }
        // Written only through review_submission_field().
        Insert: never
        Update: never
        Relationships: []
      }
      document_events: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          document_id: string
          file_name: string
          from_value: string | null
          id: number
          kind: string
          session_id: string | null
          storage_path: string | null
          to_value: string | null
        }
        // Written only by the documents trigger.
        Insert: never
        Update: never
        Relationships: []
      }
      advisor_notes: {
        Row: {
          author_email: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          session_id: string
        }
        Insert: {
          author_email?: string | null
          author_id?: string
          body: string
          created_at?: string
          id?: string
          session_id: string
        }
        // Notes are a record: never edited.
        Update: never
        Relationships: []
      }
      advisor_review_events: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          answer_from: Json | null
          answer_to: Json | null
          cause: string
          correction_changed: boolean
          created_at: string
          field: string
          from_state: string | null
          from_value: Json | null
          had_correction: boolean
          has_correction: boolean
          id: number
          reason: string | null
          session_id: string
          to_state: string | null
          to_value: Json | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      ai_request_log: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      chamber_sessions: {
        Row: {
          chamber_data: Json
          // The PEO chosen on PEO Match, kept across reloads. The certified PEO is submission.peo.
          chosen_peo: string | null
          created_at: string
          // Set by the database: 1 on insert, +1 on every update. Writes name the version they saw.
          data_version: number
          // When an uncertified draft expires; null once it was ever certified. Set by the database.
          expires_at: string | null
          field_provenance: Json
          id: string
          // The agreement (intake_consents) the intake was started under. Set by the database.
          intake_consent_id: string | null
          // When the prospect last saved anything. Set by the database.
          last_activity_at: string
          // The intake schema version chamber_data follows (supabase/functions/_shared/intakeSchema.ts).
          schema_version: number
          // in_progress | submitted | expired | archived | revoked (the last three are closed).
          status: string
          submission: Json | null
          transcript: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          chamber_data?: Json
          chosen_peo?: string | null
          created_at?: string
          data_version?: never
          expires_at?: never
          field_provenance?: Json
          id?: string
          intake_consent_id?: never
          last_activity_at?: never
          schema_version?: never
          status?: string
          submission?: Json | null
          transcript?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          chamber_data?: Json
          chosen_peo?: string | null
          created_at?: string
          data_version?: never
          expires_at?: never
          field_provenance?: Json
          id?: string
          intake_consent_id?: never
          last_activity_at?: never
          schema_version?: never
          status?: string
          submission?: Json | null
          transcript?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          extraction: Json | null
          file_name: string
          file_sha256: string | null
          file_size: string
          id: string
          metadata: string | null
          mime_type: string | null
          processing_started_at: string | null
          session_id: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          extraction?: Json | null
          file_name: string
          file_sha256?: string | null
          file_size: string
          id?: string
          metadata?: string | null
          mime_type?: string | null
          processing_started_at?: string | null
          session_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          extraction?: Json | null
          file_name?: string
          file_sha256?: string | null
          file_size?: string
          id?: string
          metadata?: string | null
          mime_type?: string | null
          processing_started_at?: string | null
          session_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chamber_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_consents: {
        // One per account and consent version (src/data/intakeConsent.ts). Read-only from the browser:
        // written only through record_intake_consent().
        Row: {
          accepted_at: string
          consent_text: string
          consent_version: string
          id: string
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      manuscript_versions: {
        Row: {
          certified_at: string | null
          certified_data_hash: string
          certified_signed_at: string
          corrections_applied: number
          file_id: string
          generated_at: string
          generated_by: string
          generated_by_email: string | null
          id: string
          pdf_sha256: string
          review_event_id: number
          sensitive_revealed: boolean
          session_id: string
          storage_path: string
          version: number
        }
        // Written only through record_manuscript_version().
        Insert: never
        Update: never
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          contact_name: string | null
          created_at: string
          employee_count: number | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          employee_count?: number | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          employee_count?: number | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      submission_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          from_status: string | null
          id: number
          note: string | null
          session_id: string
          to_status: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      submission_workflow: {
        Row: {
          session_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        // Changed only through set_submission_status().
        Insert: never
        Update: never
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advisor_email_problems: {
        Args: Record<PropertyKey, never>
        Returns: {
          reason: string
          session_id: string
          since: string
        }[]
      }
      advisor_list_outbox_events: {
        Args: { p_limit?: number; p_status?: string | null }
        Returns: {
          attempts: number
          claim_lapsed: boolean
          claimed_at: string | null
          company_name: string | null
          created_at: string
          frozen: boolean
          id: string
          kind: string
          last_error: string | null
          last_requeued_at: string | null
          next_attempt_at: string
          provider_message_id: string | null
          reference: string | null
          requeue_count: number
          resubmission: boolean
          sent_at: string | null
          session_id: string
          status: string
        }[]
      }
      advisor_list_submissions: {
        Args: { p_status?: string | null; p_search?: string | null; p_limit?: number | null; p_offset?: number }
        Returns: {
          company_name: string | null
          contact_name: string | null
          created_at: string
          employee_count: number | null
          file_id: string | null
          flagged_fields: number
          intake_status: string
          missing_required: string[]
          open_fields: number
          pipeline_status: string
          session_id: string
          signer_name: string | null
          states: string[]
          submitted_at: string | null
          total_count: number
          updated_at: string
          verified_fields: number
        }[]
      }
      advisor_outbox_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          events: number
          oldest_due_at: string | null
          status: string
        }[]
      }
      advisor_requeue_outbox_event: {
        Args: { event_id: string; rebuild_payload?: boolean }
        Returns: boolean
      }
      consume_ai_quota: {
        Args: { per_day: number; per_minute: number }
        Returns: boolean
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      intake_required_items: {
        Args: { p_data: Json; p_provenance: Json; p_verified: string[] }
        Returns: Json
      }
      is_advisor: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      archive_chamber_session: {
        Args: { p_session_id: string }
        Returns: string
      }
      expire_idle_intakes: {
        Args: { p_limit?: number }
        Returns: number
      }
      prospect_submission_status: {
        Args: { p_session_id: string }
        Returns: string | null
      }
      prospect_final_manuscript: {
        Args: { p_session_id: string }
        Returns: { version: number; storage_path: string; generated_at: string; corrections_applied: number }[]
      }
      record_intake_consent: {
        Args: { p_text: string; p_version: string }
        // When the server received the agreement (the first one, when agreeing again).
        Returns: string
      }
      record_manuscript_version: {
        Args: {
          p_certified_at: string | null
          p_certified_data_hash: string | null
          p_corrections_applied: number
          p_pdf_sha256: string
          p_review_event_id: number
          p_sensitive_revealed: boolean
          p_session_id: string
          p_storage_path: string
          p_version: number
        }
        Returns: Database["public"]["Tables"]["manuscript_versions"]["Row"]
      }
      report_client_event: {
        Args: {
          p_code?: string | null
          p_detail?: string | null
          p_kind: string
          p_route?: string | null
          p_session_id?: string | null
        }
        // False when the report was dropped by a rate cap.
        Returns: boolean
      }
      review_submission_field: {
        Args: {
          p_answer?: Json | null
          p_correction?: string
          p_field: string
          p_reason?: string | null
          p_review_state: string | null
          p_session_id: string
          p_value?: Json | null
        }
        Returns: Database["public"]["Tables"]["advisor_field_reviews"]["Row"]
      }
      revoke_chamber_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: string
      }
      session_verified_fields: {
        Args: { p_session_id: string }
        Returns: string[]
      }
      set_submission_status: {
        Args: { p_note?: string | null; p_session_id: string; p_status: string }
        Returns: Database["public"]["Tables"]["submission_workflow"]["Row"]
      }
    }
    Enums: {
      app_role: "advisor" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["advisor", "admin"],
    },
  },
} as const
