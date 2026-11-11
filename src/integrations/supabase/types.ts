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
          // The File ID (EAA-<year>-<number>), assigned by the database at the first certification and kept
          // for good; null until then. Nothing the browser sends sets or changes it.
          file_id: string | null
          id: string
          // The agreement (intake_consents) the intake was started under. Set by the database.
          intake_consent_id: string | null
          // When the prospect last saved anything. Set by the database.
          last_activity_at: string
          // The intake schema version chamber_data follows (supabase/functions/_shared/intakeSchema.ts).
          schema_version: number
          // The referral code and campaign tags of the link the intake started from (20261106100000): short codes
          // (src/data/intakeSource.ts), set when the intake is created and never changed.
          referral_code: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
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
          file_id?: never
          id?: string
          intake_consent_id?: never
          last_activity_at?: never
          referral_code?: string | null
          schema_version?: never
          status?: string
          submission?: Json | null
          transcript?: Json
          updated_at?: string
          user_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          chamber_data?: Json
          chosen_peo?: string | null
          created_at?: string
          data_version?: never
          expires_at?: never
          field_provenance?: Json
          file_id?: never
          id?: string
          intake_consent_id?: never
          last_activity_at?: never
          // The source is fixed when the intake is created: the database keeps it whatever an update sends.
          referral_code?: never
          schema_version?: never
          status?: string
          submission?: Json | null
          transcript?: Json
          updated_at?: string
          user_id?: string
          utm_campaign?: never
          utm_medium?: never
          utm_source?: never
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
          scan_attempts: number
          scan_error: string | null
          scan_locked_until: string | null
          scan_next_at: string
          scan_signature: string | null
          scan_verdict: string
          scanned_at: string | null
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
          scan_attempts?: number
          scan_error?: string | null
          scan_locked_until?: string | null
          scan_next_at?: string
          scan_signature?: string | null
          scan_verdict?: string
          scanned_at?: string | null
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
          scan_attempts?: number
          scan_error?: string | null
          scan_locked_until?: string | null
          scan_next_at?: string
          scan_signature?: string | null
          scan_verdict?: string
          scanned_at?: string | null
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
      // An advisor's request for more information (20261105090000). Written only by advisor_request_information,
      // read by advisors; never changed.
      information_requests: {
        Row: {
          fields: string[]
          id: number
          message: string
          requested_at: string
          requested_by: string | null
          requested_by_email: string | null
          session_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // Which PEOs each submission was sent to and what they answered (20261110090000). Advisors read it; it is
      // written only through advisor_record_quote_send, advisor_update_quote_request and set_submission_status.
      quote_requests: {
        Row: {
          admin_fee_pepm: number | null
          id: number
          note: string | null
          peo_name: string
          proposed_start_on: string | null
          quote_expires_on: string | null
          quote_received_on: string | null
          session_id: string
          sent_on: string | null
          sent_version: number | null
          // One of QUOTE_REQUEST_STATUSES (src/data/quoteRequests.ts).
          status: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // Every change to a quote request, and each underwriter's question: append-only, advisors read it.
      quote_request_events: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          field: string
          id: number
          new_value: string | null
          // The note a logged correction belongs to (20261111090000); null for a change to the quote request.
          note_id: number | null
          old_value: string | null
          quote_request_id: number
          session_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // The address replies about a quote request are sent to (20261111100000): the part before the @, one live
      // per quote request. Advisors read it; it is written only by advisor_record_quote_send and
      // advisor_reissue_quote_request_address.
      quote_request_addresses: {
        Row: {
          id: number
          issued_at: string
          issued_by: string | null
          issued_by_email: string | null
          local_part: string
          quote_request_id: number
          revoked_at: string | null
          revoked_by: string | null
          revoked_by_email: string | null
          session_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // Mail that reached a quote request's reply address (20261111110000). Advisors read it (admins also read held
      // mail, which has no quote request); it is written only by the receive-mail function.
      quote_request_messages: {
        Row: {
          address_local_part: string | null
          body_text: string | null
          body_truncated: boolean
          cc_addresses: string[]
          direction: string
          from_address: string
          from_name: string | null
          headers: Json
          held_reason: string | null
          id: number
          is_automatic: boolean
          new_sender: boolean
          provider_message_id: string
          quote_request_id: number | null
          recorded_at: string
          sent_at: string | null
          session_id: string | null
          subject: string | null
          to_addresses: string[]
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // What became of each attachment on that mail (20261111110000).
      quote_request_message_attachments: {
        Row: {
          content_type: string | null
          file_name: string
          id: number
          message_id: number
          not_kept_reason: string | null
          provider_attachment_id: string
          recorded_at: string
          scan_signature: string | null
          scan_verdict: string | null
          sha256: string | null
          size_bytes: number
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // When an advisor last opened a quote request's thread, for the whole team (20261111120000). Read-only from
      // the browser: written only through advisor_open_quote_request_thread().
      quote_request_thread_reads: {
        Row: {
          last_opened_at: string
          last_opened_by: string | null
          last_opened_by_email: string | null
          quote_request_id: number
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // What happened on a quote request outside the product (20261111090000). Advisors read it; it is written
      // only through advisor_add_quote_request_note and advisor_correct_quote_request_note.
      quote_request_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: number
          // One of QUOTE_NOTE_KINDS (src/data/quoteRequests.ts).
          kind: string
          // The day it happened (YYYY-MM-DD).
          noted_on: string
          quote_request_id: number
          session_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // Who refers employers, by the code in their link (20261106100000). Advisors read it; it is written only
      // through advisor_add_referral_partner and advisor_update_referral_partner.
      referral_partners: {
        Row: {
          code: string
          created_at: string
          created_by_email: string | null
          // One of REFERRAL_PARTNER_KINDS (src/data/referralPartners.ts).
          kind: string
          name: string
          updated_at: string
          updated_by_email: string | null
        }
        Insert: never
        Update: never
        Relationships: []
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
          // When the account asked to be emailed before an unfinished intake closes (server time); null for no.
          draft_reminders_at: string | null
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
          draft_reminders_at?: string | null
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
          draft_reminders_at?: string | null
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
          // The quote request whose quote the employer took, once won (20261110090000).
          won_quote_request_id: number | null
          needs_action: boolean
          needs_action_at: string | null
          needs_action_by: string | null
          needs_action_by_email: string | null
          needs_action_note: string | null
          session_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        // Changed only through set_submission_status() and set_submission_needs_action().
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
      // The pilot funnel (20261105092000): each step, how many intakes started in the period reached it, the median minutes.
      advisor_intake_funnel: {
        Args: { p_from: string; p_to: string }
        Returns: { step: number; milestone: string; intakes: number; median_minutes: number | null }[]
      }
      // The funnel by source (20261106100000): for intakes started in the period, each source and how many of its
      // intakes reached each step. Intakes with no source are one row whose codes are all null.
      advisor_intake_sources: {
        Args: { p_from: string; p_to: string }
        Returns: {
          referral_code: string | null
          partner_name: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          started: number
          answered: number
          document_uploaded: number
          census_provided: number
          ready_to_certify: number
          email_verified: number
          certified: number
          manuscript_downloaded: number
        }[]
      }
      // Adds a referral partner under a new code; a code already taken is refused (23505).
      advisor_add_referral_partner: {
        Args: { p_code: string; p_name: string; p_kind: string }
        Returns: Database["public"]["Tables"]["referral_partners"]["Row"]
      }
      // Renames a referral partner or changes its kind; the code never changes.
      advisor_update_referral_partner: {
        Args: { p_code: string; p_name: string; p_kind: string }
        Returns: Database["public"]["Tables"]["referral_partners"]["Row"]
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
        Args: {
          p_status?: string | null
          p_search?: string | null
          p_limit?: number | null
          p_offset?: number
          p_needs_action?: boolean | null
          p_waiting?: boolean | null
          p_sort?: string | null
        }
        Returns: {
          company_name: string | null
          contact_name: string | null
          created_at: string
          employee_count: number | null
          file_id: string | null
          flagged_fields: number
          intake_status: string
          missing_required: string[]
          needs_action: boolean
          needs_action_note: string | null
          earliest_quote_expires_on: string | null
          new_peo_mail_requests: number
          oldest_waiting_on: string | null
          open_fields: number
          pipeline_status: string
          quote_requests_sent: number
          quotes_received: number
          sent_older_version: boolean
          start_month: string | null
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
      advisor_request_information: {
        Args: { p_fields?: string[]; p_message: string; p_session_id: string }
        Returns: Json
      }
      advisor_add_quote_request_note: {
        Args: { p_body: string; p_kind: string; p_noted_on: string; p_quote_request_id: number }
        Returns: Json
      }
      advisor_correct_quote_request_note: {
        Args: { p_body: string; p_kind: string; p_note_id: number; p_noted_on: string }
        Returns: Json
      }
      advisor_note_underwriter_question: {
        Args: { p_question: string; p_quote_request_id: number }
        Returns: Json
      }
      advisor_open_quote_request_thread: {
        Args: { p_quote_request_id: number; p_seen_through?: string | null }
        Returns: Json
      }
      advisor_reissue_quote_request_address: {
        Args: { p_quote_request_id: number }
        Returns: Json
      }
      advisor_record_quote_send: {
        Args: { p_peo: string; p_sent_on?: string | null; p_session_id: string }
        Returns: Json
      }
      advisor_update_quote_request: {
        Args: {
          p_admin_fee_pepm?: number | null
          p_expires_on?: string | null
          p_note?: string | null
          p_quote_request_id: number
          p_received_on?: string | null
          p_start_on?: string | null
          p_status: string
        }
        Returns: Json
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
      // The latest request on the caller's own intake while the pipeline waits on them: { message, fields, requested_at }.
      prospect_information_request: {
        Args: { p_session_id: string }
        Returns: Json | null
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
      // The prospect downloaded The Manuscript of their own certified intake; true the first time.
      record_manuscript_download: {
        Args: { p_session_id: string }
        Returns: boolean
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
      set_submission_needs_action: {
        Args: { p_needs_action: boolean; p_note?: string | null; p_session_id: string }
        Returns: Database["public"]["Tables"]["submission_workflow"]["Row"]
      }
      set_submission_status: {
        Args: { p_note?: string | null; p_session_id: string; p_status: string; p_won_quote_request_id?: number | null }
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
