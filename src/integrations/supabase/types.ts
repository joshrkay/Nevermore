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
          extra_answers: Json
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
          // The firm the intake belongs to (20261116090000), set by the database.
          firm_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          // in_progress | submitted | expired | archived | revoked (the last three are closed).
          status: string
          submission: Json | null
          transcript: Json
          updated_at: string
          // The employer; empty for a broker-started intake until its invitee accepts (20261123120000, D-1703).
          user_id: string | null
          // The member of the firm who started the intake, for a broker-started one; set by the database (20261123120000).
          started_by: string | null
        }
        Insert: {
          chamber_data?: Json
          chosen_peo?: string | null
          extra_answers?: Json
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
          started_by?: never
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
          extra_answers?: Json
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
          started_by?: never
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
      // read by advisors; never changed. extra_questions: 20261115130000.
      information_requests: {
        Row: {
          extra_questions: Json
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
          // M-2.3: the version a quote was given on, while quoted; older than sent_version after an update, until a new answer is recorded.
          quoted_version?: number | null
          // Why it was withdrawn (M-2.4), one of WITHDRAWAL_REASONS, for advisors only; cleared when a send reopens it.
          withdrawn_reason?: string | null
          // N-1.4: why the PEO declined, one of DECLINE_REASONS, and its own words; kept when the request moves on, replaced by a later decline.
          decline_reason?: string | null
          decline_words?: string | null
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
          held_at: string | null
          held_reason: string | null
          id: number
          is_automatic: boolean
          moved_by: string | null
          moved_by_email: string | null
          moved_from_quote_request_id: number | null
          moved_note: string | null
          new_sender: boolean
          provider_message_id: string
          quote_request_id: number | null
          recorded_at: string
          sent_at: string | null
          session_id: string | null
          subject: string | null
          to_addresses: string[]
          // A message the product sent through the advisor's mailbox (direction 'sent', M-2.1, 20261122140000): its state, and why it failed.
          status?: "queued" | "sent" | "failed" | null
          failure_kind?: "mailbox" | "refused" | "uncertain" | "unavailable" | null
          failure_reason?: string | null
          message_id?: string | null
          in_reply_to?: string | null
          message_references?: string[]
          sender_id?: string | null
          bundle_link_id?: number | null
          // M-2.3: the version the PEO held when this message is an update; null on every other message.
          update_from_version?: number | null
          // N-1.1 (20261125100000): what the AI suggested the reply means, and what the agent did with it. Never the reply's words.
          suggested_status?: "acknowledged" | "question_open" | "quoted" | "declined" | null
          suggestion_outcome?: "accepted" | "dismissed" | null
          suggestion_decided_by?: string | null
          suggestion_decided_at?: string | null
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
      // The retired platform list of organisations whose members got the advisor role without an admin (20261113100000). Admins read it as
      // history; nothing changes it since 20261118100000, which dropped the functions that did.
      allowed_organisations: {
        Row: {
          added_at: string
          added_by: string | null
          added_by_email: string | null
          id: number
          label: string
          // A Google hosted domain, or a Microsoft tenant ID.
          org_id: string
          provider: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // Every change to that list and every role it granted (20261113100000). Admins read it; append-only.
      advisor_role_events: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          at: string
          id: number
          kind: string
          org_id: string
          org_label: string | null
          provider: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // A firm's record of who did what (20261116160001): kinds and ids, never content. Append-only; a firm's owners
      // read their own firm's through firm_activity_list(); written only through record_firm_activity().
      firm_activity: {
        Row: {
          // The stored actor is never granted to a firm: only that an entry was by Nevermore's own people (D-33).
          actor_is_staff: boolean
          at: string
          entry_key: string
          firm_id: string
          kind: string
          record_id: string
          record_type: string
          role: string | null
          // How many rows an export held (20261119090000); null for any other kind of entry.
          row_count: number | null
          subject_user_id: string | null
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
      // What a PEO quoted on a quote request, the whole offer (20261124140000). Firm members read it; it is written only through record_quote. A cost area that is null
      // was not quoted (it is never an empty list or 0). The newest row of a quote request is its current quote.
      quotes: {
        Row: {
          // The fee in dollars per employee per month, or in percent of payroll, as admin_fee_basis says; null with its basis.
          admin_fee: number | null
          // One of QUOTE_ADMIN_FEE_BASES (src/data/quoteRequests.ts).
          admin_fee_basis: string | null
          // The mail attachment (quote_request_message_attachments.id) the PEO's quote document is, or null (20261125090000): a file stored and scanned on the quote request's own mail.
          document_attachment_id: number | null
          expires_on: string | null
          id: number
          // One of QUOTE_KINDS: an estimate or a firm offer.
          kind: string
          // Each { plan, tier, monthly }, or null.
          medical: Json | null
          note: string | null
          // Each { name, amount }, or null.
          one_off_fees: Json | null
          proposed_start_on: string | null
          quote_request_id: number
          received_on: string | null
          session_id: string
          // Each { state, charge: 'employer_rate' } or { state, charge: 'peo_rate', rate }, or null.
          unemployment: Json | null
          // Each { state, class_code, rate per 100 dollars of payroll }, or null.
          workers_comp: Json | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // Who refers employers, by the code in their link (20261106100000). Advisors read it; it is written only
      // through advisor_add_referral_partner and advisor_update_referral_partner.
      // PEOs and their requirement profiles (20261115090000). Advisors read the PEOs and the published versions
      // (admins read drafts too); everyone else signed in reads peo_catalog(). Only admins write, through admin_add_peo(),
      // admin_save_peo_profile(), admin_publish_peo_profile(), admin_set_peo_listed(), admin_recheck_peo_profile() and
      // admin_discard_peo_draft() (20261115100000). A published version never changes; a PEO is never deleted.
      peos: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          // False once an admin stops listing the PEO; a PEO is never deleted.
          listed: boolean
          name: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      peo_profile_versions: {
        Row: {
          // Each { format, template_file, columns: [{ header, from }] } (src/data/peoProfiles.ts), or null. template_file is
          // null or { id, sheet, header_row, first_row }: the PEO's own template the census fills (L-3.1).
          census_layout: Json | null
          created_at: string
          created_by: string | null
          // [{ category, description }]
          documents: Json
          excluded_class_codes: string[] | null
          excluded_industries: string[] | null
          // { <industry, as excluded_industries words it>: [<class code>] } (20261115110000).
          excluded_industry_codes: Json
          // [{ key, text, kind, choices? }]
          extra_questions: Json
          id: number
          min_enrolment_percent: number | null
          min_headcount: number | null
          needed_before_signing: string[]
          needed_to_quote: string[]
          peo_id: number
          published_at: string | null
          published_by: string | null
          // A draft's state, new on every save; a save or a publish names the one it was based on.
          revision: string
          // { <part>: { kind, name, role?, link?, checked_on } }, one per sourced part (PROFILE_PARTS in src/data/peoProfiles.ts).
          sources: Json
          states_served: string[] | null
          // One of PROFILE_STATUSES.
          status: string
          version: number
        }
        Insert: never
        Update: never
        Relationships: []
      }
      // The people at a PEO a profile version names: advisors read them, prospects never do.
      peo_contacts: {
        Row: {
          email: string | null
          id: number
          name: string
          phone: string | null
          position: number
          profile_version_id: number
          role: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      peo_census_templates: {
        // A PEO's own census template (20261115140000). Read by advisors; written only by census-template-upload.
        Row: {
          file_name: string
          file_sha256: string
          id: number
          peo_id: number
          scan_signature: string | null
          // One of TEMPLATE_WORKBOOK_STATUSES (src/lib/templateWorkbooks.ts).
          scan_status: string
          scanned_at: string | null
          size_bytes: number
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      referral_partners: {
        Row: {
          code: string
          created_at: string
          created_by_email: string | null
          // The firm the partner belongs to (20261116200000); a code is unique within it.
          firm_id: string
          // One of REFERRAL_PARTNER_KINDS (src/data/referralPartners.ts).
          kind: string
          name: string
          updated_at: string
          updated_by_email: string | null
          // Raised by a trigger by one whenever the name or the kind really changes; a save names the one it started from (20261118160000).
          version: number
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
      // A member reads their own firm (20261116090000): the columns granted to them.
      firms: {
        Row: {
          id: string
          name: string
          address: string
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
      // Every PEO, alphabetically, with its newest published profile or null (20261115090000). Never a contact.
      peo_catalog: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_add_peo: {
        Args: { p_name: string }
        Returns: Json
      }
      admin_save_peo_profile: {
        Args: { p_draft_revision: string | null; p_in_use_version: number | null; p_peo_id: number; p_profile: Json }
        Returns: Json
      }
      admin_publish_peo_profile: {
        Args: { p_draft_revision: string | null; p_peo_id: number }
        Returns: Json
      }
      admin_set_peo_listed: {
        Args: { p_listed: boolean; p_peo_id: number }
        Returns: Json
      }
      admin_recheck_peo_profile: {
        Args: { p_peo_id: number; p_sources: Json }
        Returns: Json
      }
      admin_discard_peo_draft: {
        Args: { p_peo_id: number }
        Returns: undefined
      }
      // Where a clean PEO template workbook of this PEO is stored, or null (20261115140000).
      clean_template_workbook_path: {
        Args: { p_peo_id: number; p_template_id: number }
        Returns: string | null
      }
      // Whether the signed-in broker's own mailbox is connected, never the token (20261113090000).
      my_mailbox: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
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
      // The funnel by source (20261106100000), asked for one firm the caller belongs to (20261116200500): for that firm's intakes
      // started in the period, each source and how many of its intakes reached each step. Intakes with no source are one row whose codes are all null.
      advisor_intake_sources: {
        Args: { p_from: string; p_to: string; p_firm_id: string }
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
          // The firm the row is about (20261116200500): a code is unique within a firm, not across firms.
          firm_id: string
        }[]
      }
      // Adds a referral partner under a new code; a code already taken is refused (23505).
      advisor_add_referral_partner: {
        Args: { p_code: string; p_name: string; p_kind: string; p_firm_id?: string | null }
        Returns: Database["public"]["Tables"]["referral_partners"]["Row"]
      }
      // A page of one firm's record (p_firm_id), newest first, for that firm's current owners only (20261116160001).
      firm_activity_list: {
        Args: { p_firm_id: string; p_person?: string | null; p_kind?: string | null; p_limit?: number; p_before_at?: string | null; p_before_key?: string | null; p_nevermore?: boolean }
        Returns: {
          actor_email: string | null
          actor_id: string | null
          at: string
          // True when a person at Nevermore did it: no id and no email, shown as "Nevermore" (D-33).
          by_nevermore: boolean
          entry_key: string
          kind: string
          record_id: string
          record_type: string
          role: string | null
          // How many rows an export held (20261119090000); null for any other kind of entry.
          row_count: number | null
          subject_email: string | null
          subject_user_id: string | null
        }[]
      }
      // The accounts table's query (20261119130000): one page, {rows, total, page, page_size}; src/lib/accountsApi.ts reads it. A null firm is the firm at the address.
      accounts_list: {
        Args: { p_firm_id: string | null; p_filters?: Json; p_sort?: string | null; p_direction?: string; p_page?: number; p_search?: string | null; p_time_zone?: string }
        Returns: Json
      }
      accounts_view_counts: {
        Args: { p_firm_id: string | null; p_views: Json; p_search?: string | null; p_time_zone?: string }
        Returns: { view_name: string; total: number }[]
      }
      // The leads table's query (20261121110500): {rows, total, page, page_size}; src/lib/leadsApi.ts reads it.
      leads_list: {
        Args: {
          p_firm_id: string | null
          p_filters?: Json
          p_sort?: string | null
          p_direction?: string
          p_page?: number
          p_search?: string | null
          p_time_zone?: string
        }
        Returns: Json
      }
      leads_view_counts: {
        Args: { p_firm_id: string | null; p_views: Json; p_search?: string | null; p_time_zone?: string }
        Returns: { view_name: string; total: number }[]
      }
      // The quotes table's query (20261123180000, CRM-Q4.1): {rows, total, page, page_size}, one row for each PEO of each opportunity and one for each New quote
      // left half done; src/lib/quotesApi.ts reads it.
      quotes_list: {
        Args: {
          p_firm_id: string | null
          p_filters?: Json
          p_sort?: string | null
          p_direction?: string
          p_page?: number
          p_search?: string | null
          p_time_zone?: string
        }
        Returns: Json
      }
      quotes_view_counts: {
        Args: { p_firm_id: string | null; p_views: Json; p_search?: string | null; p_time_zone?: string }
        Returns: { view_name: string; total: number }[]
      }
      // The inbox (20261122150000, CRM-E1.4): {rows, total, page, page_size}, every message on the threads the caller may see, newest first;
      // src/lib/inboxApi.ts reads it.
      inbox_list: {
        Args: {
          p_firm_id: string | null
          p_filters?: Json
          p_sort?: string | null
          p_direction?: string
          p_page?: number
          p_search?: string | null
          p_time_zone?: string
        }
        Returns: Json
      }
      inbox_view_counts: {
        Args: { p_firm_id: string | null; p_views: Json; p_search?: string | null; p_time_zone?: string }
        Returns: { view_name: string; total: number }[]
      }
      // The firm's current members by id and name, for the Owner filter (20261119130000).
      firm_member_choices: {
        Args: { p_firm_id: string | null }
        Returns: { user_id: string; name: string }[]
      }
      // An account's page (20261119140000): {account, can_change, tabs: {contacts, opportunities, quotes, activity, files}}, each tab {count, rows} with its first five
      // rows; null, the same as for an account that is not there, for anyone who may not see the account. src/lib/accountPageApi.ts reads it.
      account_page: {
        Args: { p_firm_id: string; p_account_id: string }
        Returns: Json
      }
      // What the account's latest certified intake says where the account differs (20261123190000): {field: value}, only for those fields; null for anyone who may not see the account.
      account_intake_says: {
        Args: { p_firm_id: string; p_account_id: string }
        Returns: Json
      }
      // An account's files that passed the virus check: {count, rows}, a page of at most 100; null for anyone who may not see the account.
      account_files: {
        Args: { p_firm_id: string; p_account_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      // A page of one tab of an account's page (contacts, opportunities, quotes, activity (or activity_calls, activity_notes, activity_tasks, activity_changes) or files): {count, rows}; null for anyone who may not see the account.
      account_tab: {
        Args: { p_firm_id: string; p_account_id: string; p_tab: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      // A contact's page (20261119240000): the contact, its account, whether the person may change or move it, and the opportunities it is the main contact of; null for anyone who may not see its account.
      contact_page: {
        Args: { p_firm_id: string; p_contact_id: string }
        Returns: Json
      }
      // A page of the contact's calls, notes and tasks, newest first, narrowed to all, calls, notes or tasks: {count, rows}; null for anyone who may not see its account.
      contact_activity: {
        Args: { p_firm_id: string; p_contact_id: string; p_filter?: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      // The save of a contact's own fields from a version: {conflict: false, record, previous_main} or the conflict answer.
      update_contact: {
        Args: {
          p_contact_id: string
          p_first_name: string | null
          p_last_name: string
          p_title: string | null
          p_email: string | null
          p_phone: string | null
          p_mobile: string | null
          p_owner_id?: string | null
          p_is_main?: boolean
          p_do_not_email?: boolean
          p_firm_id?: string | null
          p_version?: number | null
        }
        Returns: Json
      }
      // The opportunity's page (20261120120000): the opportunity with its stage, account, owner, main contact, quote requests, intake summary and contacts; raises PT404 for one
      // that is not there or may not be seen. Its activity (calls, notes, tasks, history and the quote requests' events, newest first): {count, rows}. And the save of its own fields
      // from a version: {conflict: false, record} or the conflict answer.
      opportunity_page: {
        Args: { p_firm_id: string; p_opportunity_id: string }
        Returns: Json
      }
      opportunity_activity: {
        Args: { p_firm_id: string; p_opportunity_id: string; p_filter?: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      update_opportunity: {
        Args: {
          p_opportunity_id: string
          p_name: string
          p_target_start: string | null
          p_employees: number | null
          p_main_contact_id: string | null
          p_expected_close: string | null
          p_value: number | null
          p_source: string | null
          p_next_step: string | null
          p_owner_id?: string | null
          p_firm_id?: string | null
          p_version?: number | null
        }
        Returns: Json
      }
      // Calls, notes and tasks (20261119180000): log one (a call may carry a follow-up task), change a call or task or a note's text, add to a note, mark a task done,
      // and what the log form offers. Each answers the row, {activity, follow_up} for log_activity.
      log_activity: {
        Args: {
          p_kind: string
          p_account_id: string
          p_contact_id?: string | null
          p_opportunity_id?: string | null
          p_at?: string | null
          p_outcome?: string | null
          p_body?: string | null
          p_title?: string | null
          p_due_on?: string | null
          p_for?: string | null
          p_follow_up_title?: string | null
          p_follow_up_due_on?: string | null
          p_follow_up_for?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      update_activity: {
        Args: {
          p_activity_id: string
          p_contact_id?: string | null
          p_opportunity_id?: string | null
          p_at?: string | null
          p_outcome?: string | null
          p_body?: string | null
          p_title?: string | null
          p_due_on?: string | null
          p_for?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      add_to_note: {
        Args: { p_activity_id: string; p_text: string; p_firm_id?: string | null }
        Returns: Json
      }
      set_task_done: {
        Args: { p_activity_id: string; p_done: boolean; p_firm_id?: string | null }
        Returns: Json
      }
      account_activity_options: {
        Args: { p_firm_id: string; p_account_id: string }
        Returns: Json
      }
      // The id and name of the account that holds a submission, for someone who may see that account; null for anyone else.
      submission_account: {
        Args: { p_firm_id: string; p_submission_id: string }
        Returns: Json
      }
      // The save of an account's own fields from a version: {conflict: false, record} or {conflict: true, currentVersion, current, changed}.
      update_account: {
        Args: {
          p_account_id: string
          p_name: string
          p_trade_name: string | null
          p_website: string | null
          p_phone: string | null
          p_street: string | null
          p_city: string | null
          p_state: string | null
          p_postal_code: string | null
          p_industry: string | null
          p_employees: number | null
          p_states_of_operation: string[]
          p_current_provider: string | null
          p_firm_id?: string | null
          p_version?: number | null
        }
        Returns: Json
      }
      // The firm's current people the caller may make an account for, by the level rule (20261119150000), for the New account form's Owner choice.
      account_owner_choices: {
        Args: { p_firm_id: string | null }
        Returns: { user_id: string; name: string }[]
      }
      // Makes an account by hand (20261119150000): the made account's own fields (the same shape as a save's `record`). The owner is the caller unless one is named.
      create_account: {
        Args: {
          p_name: string
          p_trade_name: string | null
          p_website: string | null
          p_phone: string | null
          p_street: string | null
          p_city: string | null
          p_state: string | null
          p_postal_code: string | null
          p_industry: string | null
          p_employees: number | null
          p_states_of_operation: string[]
          p_current_provider: string | null
          p_owner_id?: string | null
          p_firm_id?: string | null
          // Added by hand unless said; New quote's step 1 says 'new_quote' (20261123130000).
          p_source?: string
        }
        Returns: Json
      }
      // Making a lead by hand (20261121095500): answers the lead's own fields (crm_lead_fields).
      create_lead: {
        Args: {
          p_name: string
          p_title?: string | null
          p_business?: string | null
          p_email?: string | null
          p_phone?: string | null
          p_city?: string | null
          p_state?: string | null
          p_employees?: number | null
          p_current_provider?: string | null
          p_note?: string | null
          p_owner_id?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      // Writing to a contact or a lead (20261122090000): records the message queued on the record's conversation and answers it
      // (conversation_message_fields). PT404 a record the caller may not see; PT409 Do not email, no email, a lead in the bin or converted; PT412 no mailbox.
      send_conversation_message: {
        Args: {
          p_contact_id?: string | null
          p_lead_id?: string | null
          p_subject?: string | null
          p_body?: string | null
          p_cc?: string[] | null
          p_in_reply_to?: string | null
          p_firm_id?: string | null
          // Files from the contact's account's files, each sent as an expiring link (20261122160000, D-605); 22023 for any other.
          p_document_ids?: string[] | null
        }
        Returns: Json
      }
      // The files a message to this contact may carry (20261122160000): [{id, file_name, category, created_at}]; PT404 a contact the caller may not see.
      conversation_files_for: {
        Args: {
          p_contact_id: string
          p_firm_id?: string | null
        }
        Returns: Json
      }
      // A contact's or a lead's conversation, newest first: {conversation, messages, mailbox: {connected, last_send_failed}} (20261122090000).
      conversation_for: {
        Args: {
          p_contact_id?: string | null
          p_lead_id?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      // Replies come back (20261122130000, CRM-E1.3): a conversation opened clears its new-mail mark for the firm, answering {last_opened_at}; a new sender
      // offered on a contact's conversation added as a contact on its account (add_contact's answer); an account's or an opportunity's mail, {messages}.
      open_conversation: {
        Args: {
          p_conversation_id: string
          p_seen_through?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      add_sender_as_contact: {
        Args: {
          p_message_id: string
          p_first_name?: string | null
          p_last_name?: string | null
          p_title?: string | null
          p_phone?: string | null
          p_mobile?: string | null
          p_owner_id?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      account_conversation_messages: {
        Args: {
          p_account_id?: string | null
          p_opportunity_id?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      // Adding a contact to an account and moving one (20261119170000): add_contact answers {record, previous_main}; move_contact {record, from, to, was_main,
      // activities_moved, opportunity_links_dropped, main_contact_cleared} (PT409 asks for p_confirm); the choices are the accounts it may go to; the context is what the form needs.
      add_contact: {
        Args: {
          p_account_id: string
          p_first_name: string | null
          p_last_name: string | null
          p_title: string | null
          p_email: string | null
          p_phone: string | null
          p_mobile: string | null
          p_owner_id?: string | null
          p_is_main?: boolean
          p_do_not_email?: boolean
          p_firm_id?: string | null
        }
        Returns: Json
      }
      move_contact: { Args: { p_contact_id: string; p_to_account_id: string; p_confirm?: boolean; p_firm_id?: string | null }; Returns: Json }
      contact_move_choices: { Args: { p_firm_id: string | null; p_contact_id: string; p_search?: string }; Returns: { id: string; name: string }[] }
      add_contact_context: { Args: { p_firm_id: string | null; p_account_id: string }; Returns: Json }
      // New opportunity on an account (20261120130000): the context is what the form needs ({account: {id, name, archived, employees}, main_contact, contacts, partners, owners});
      // opportunity_create makes it (stage Qualifying, no intake) and answers {record} with its stage and referral_partner_code.
      opportunity_create_context: { Args: { p_firm_id: string | null; p_account_id: string }; Returns: Json }
      opportunity_create: {
        Args: {
          p_account_id: string
          p_name: string | null
          p_target_start: string | null
          p_employees: number | null
          p_main_contact_id: string | null
          p_expected_close: string | null
          p_value: number | null
          p_source: string | null
          p_referral_partner_code: string | null
          p_next_step: string | null
          p_owner_id?: string | null
          p_firm_id?: string | null
          // Start the renewal (20261121160000, D-449): the renewal this opportunity works, linked in the same transaction.
          p_renewal_id?: string | null
        }
        Returns: Json
      }
      // Won, lost and reopened (20261120121000, restated by 20261121170000): each all or none, from the version the person started from, and answering
      // {conflict: false, record: {id, stage, version, ...}} or {conflict: true, currentVersion, current: {stage}, changed}. A win and a reopening move the
      // opportunity's version (won_at and won_by are tracked fields), and the answer names the new one.
      opportunity_mark_won: {
        Args: {
          p_opportunity_id: string
          p_quote_request_id: number
          p_start_date?: string | null
          p_renewal_date?: string | null
          p_broker_of_record?: string | null
          p_firm_id?: string | null
          p_version?: number | null
          p_commission_basis?: string | null
          p_commission_rate?: number | null
          p_commission_expected_yearly?: number | null
          p_time_zone?: string
        }
        Returns: Json
      }
      // opportunity_mark_won and one withdrawal queued on each PEO still open, in one transaction: the won answer and {message_ids}.
      opportunity_mark_won_and_withdraw: {
        Args: {
          p_opportunity_id: string
          p_quote_request_id: number
          p_start_date: string | null
          p_renewal_date: string | null
          p_broker_of_record: string | null
          p_firm_id: string | null
          p_version: number | null
          p_commission_basis: string | null
          p_commission_rate: number | null
          p_commission_expected_yearly: number | null
          p_time_zone: string
          p_subject: string
          p_body: string
        }
        Returns: Json
      }
      // opportunity_mark_lost and one withdrawal queued on every PEO still open, in one transaction.
      opportunity_mark_lost_and_withdraw: {
        Args: { p_opportunity_id: string; p_reason: string; p_note: string | null; p_firm_id: string | null; p_version: number | null; p_subject: string; p_body: string }
        Returns: Json
      }
      opportunity_mark_lost: {
        Args: { p_opportunity_id: string; p_reason: string; p_note?: string | null; p_firm_id?: string | null; p_version?: number | null }
        Returns: Json
      }
      opportunity_reopen: { Args: { p_opportunity_id: string; p_firm_id?: string | null; p_version?: number | null }; Returns: Json }
      // Commission received (20261120121000): record one against a placement ({payment, received_to_date, expected_yearly}), save one from its version ({conflict: false,
      // record, received_to_date, expected_yearly} or {conflict: true, currentVersion, current: {received_on, amount, note}, changed}), delete one from its version
      // ({deleted: true, amount, received_to_date} or the same conflict), and add, change or clear a placement's expected commission from the placement's version.
      record_commission_payment: {
        Args: { p_placement_id: string; p_received_on: string; p_amount: number; p_note?: string | null; p_firm_id?: string | null }
        Returns: Json
      }
      update_commission_payment: {
        Args: { p_payment_id: string; p_received_on: string; p_amount: number; p_note?: string | null; p_firm_id?: string | null; p_version?: number | null }
        Returns: Json
      }
      delete_commission_payment: { Args: { p_payment_id: string; p_firm_id?: string | null; p_version?: number | null }; Returns: Json }
      set_placement_commission: {
        Args: {
          p_placement_id: string
          p_firm_id?: string | null
          p_version?: number | null
          p_basis?: string | null
          p_rate?: number | null
          p_expected_yearly?: number | null
        }
        Returns: Json
      }
      // How an opportunity ended, in one read (20261121170000): {lost_reason, lost_note, placement, renewal, payments, received_to_date, quotes}; raises PT404 as opportunity_page does.
      opportunity_outcome: { Args: { p_firm_id: string; p_opportunity_id: string }; Returns: Json }
      // The comparison of an opportunity's quotes and the notes on it (20261125110000, N-3.1, N-3.2): {can_add, columns: [{quote_request_id, peo_name, status, quote}], notes};
      // raises PT404 as opportunity_page does. add_comparison_note adds a note (internal or client) and answers {id, body}.
      opportunity_quote_comparison: { Args: { p_firm_id: string; p_opportunity_id: string }; Returns: Json }
      add_comparison_note: {
        Args: { p_firm_id: string; p_opportunity_id: string; p_quote_request_id: number | null; p_area: string | null; p_visibility: string; p_body: string }
        Returns: Json
      }
      // Renewals (20261120110000, CRM-A2.4a): an account's renewals with days away, and adding, changing and deleting one from a version; "Didn't renew" and its undo.
      account_renewals: { Args: { p_firm_id: string | null; p_account_id: string; p_time_zone?: string }; Returns: Json }
      add_renewal: {
        Args: { p_account_id: string; p_kind: string; p_with_whom: string; p_renews_on: string; p_placement_start_on?: string | null; p_firm_id?: string | null; p_time_zone?: string }
        Returns: Json
      }
      update_renewal: {
        Args: { p_renewal_id: string; p_with_whom: string; p_renews_on: string; p_firm_id?: string | null; p_version?: number | null; p_time_zone?: string }
        Returns: Json
      }
      delete_renewal: { Args: { p_renewal_id: string; p_firm_id?: string | null; p_version?: number | null }; Returns: Json }
      mark_renewal_not_renewed: {
        Args: { p_renewal_id: string; p_not_renewed_on: string; p_firm_id?: string | null; p_version?: number | null; p_time_zone?: string }
        Returns: Json
      }
      undo_renewal_not_renewed: { Args: { p_renewal_id: string; p_firm_id?: string | null; p_version?: number | null; p_time_zone?: string }; Returns: Json }
      // Spotting a duplicate while typing (20261121090000): {matches, more}; a match the person may see in full, one they may not as a mask.
      duplicate_account_check: { Args: { p_firm_id: string | null; p_name: string; p_website: string; p_state: string }; Returns: Json }
      duplicate_contact_check: { Args: { p_firm_id: string | null; p_email: string }; Returns: Json }
      // Archive, restore and delete an account, and change its owner (20261119160000): archive and restore answer {changed, record}; delete {deleted, name}
      // (PT409 for an account that has an opportunity); the owner change {record, owner, opportunities_changed, opportunities_skipped}.
      archive_account: { Args: { p_account_id: string; p_firm_id?: string | null }; Returns: Json }
      restore_account: { Args: { p_account_id: string; p_firm_id?: string | null }; Returns: Json }
      delete_account: { Args: { p_account_id: string; p_firm_id?: string | null }; Returns: Json }
      // Merging (20261121100000). The preview answers {kind, problem, differs, kept, removed, moves}; a merge {record, removed: {id, name}, moved}; keep separate
      // {record, was_duplicate_of}; the old address {kind, id, name} (a contact adds account_id), or null. src/lib/mergeApi.ts reads them.
      merge_preview: { Args: { p_firm_id: string | null; p_kind: string; p_kept_id: string; p_removed_id: string }; Returns: Json }
      merge_accounts: {
        Args: { p_kept_id: string; p_removed_id: string; p_choices?: Json; p_kept_version?: number | null; p_removed_version?: number | null; p_firm_id?: string | null }
        Returns: Json
      }
      merge_contacts: {
        Args: { p_kept_id: string; p_removed_id: string; p_choices?: Json; p_kept_version?: number | null; p_removed_version?: number | null; p_firm_id?: string | null }
        Returns: Json
      }
      account_keep_separate: { Args: { p_account_id: string; p_firm_id?: string | null }; Returns: Json }
      resolve_merged_record: { Args: { p_firm_id: string | null; p_kind: string; p_id: string }; Returns: Json | null }
      accounts_can_change: { Args: { p_firm_id?: string | null; p_ids: string[] }; Returns: string[] }
      leads_can_convert: { Args: { p_firm_id: string; p_ids: string[] }; Returns: string[] }
      change_account_owner: {
        Args: { p_account_id: string; p_owner_id: string; p_change_open_opportunities?: boolean; p_firm_id?: string | null }
        Returns: Json
      }
      // Bulk changes to accounts (20261119210000): the preview and the change answer {action, selected, limit, too_many, unavailable, will_change, unchanged,
      // skipped, owner?, label?, opportunities?} (the change adds changed, change_id, undo_until); the undo {restored, skipped, opportunities}.
      // src/lib/bulkChangeApi.ts reads them. Exactly one of p_filters (the table's filters, search and time zone) and p_ids.
      bulk_accounts_preview: {
        Args: { p_firm_id: string; p_action: string; p_params?: Json; p_filters?: Json | null; p_ids?: Json | null }
        Returns: Json
      }
      bulk_accounts_change: {
        Args: { p_firm_id: string; p_action: string; p_params?: Json; p_filters?: Json | null; p_ids?: Json | null }
        Returns: Json
      }
      bulk_accounts_undo: { Args: { p_change_id: string; p_firm_id?: string | null }; Returns: Json }
      firm_labels: { Args: { p_firm_id?: string | null }; Returns: Json }
      // Bulk changes to leads, their undo, the bin and Restore (20261122210000; src/lib/leadsBulkApi.ts reads them).
      bulk_leads_preview: {
        Args: { p_firm_id: string; p_action: string; p_params?: Json; p_filters?: Json | null; p_ids?: Json | null }
        Returns: Json
      }
      bulk_leads_change: {
        Args: { p_firm_id: string; p_action: string; p_params?: Json; p_filters?: Json | null; p_ids?: Json | null }
        Returns: Json
      }
      // Change the owner of the opportunities of quotes, or close their quote requests (20261123180000, CRM-Q4.1): {action, selected, requested, unavailable, changed, unchanged, skipped}.
      bulk_quotes_change: {
        Args: { p_firm_id: string; p_action: string; p_params?: Json; p_filters?: Json | null; p_ids?: Json | null }
        Returns: Json
      }
      bulk_leads_undo: { Args: { p_change_id: string; p_firm_id?: string | null }; Returns: Json }
      leads_bin: { Args: { p_firm_id: string; p_page?: number }; Returns: Json }
      restore_leads: { Args: { p_firm_id: string; p_ids: Json }; Returns: Json }
      // A table taken out, with its record in the same step (20261119090000): one value, {table, label, columns, rows, count, skipped, exportedAt}.
      // src/lib/exportApi.ts reads it. p_ids is null for a whole table, or a list of the records' ids for a selection.
      export_rows: {
        Args: { p_firm_id: string; p_table: string; p_filters?: Json; p_ids?: Json | null }
        Returns: Json
      }
      firm_activity_people: {
        Args: { p_firm_id: string }
        Returns: { email: string | null; is_nevermore: boolean; user_id: string | null }[]
      }
      // The firms the caller currently belongs to, with their role in each, for a caller past the second factor.
      my_firms: {
        Args: Record<PropertyKey, never>
        Returns: { firm_id: string; name: string; address: string; role: string; refused: boolean }[]
      }
      // The firms the caller currently owns, by name.
      my_owner_firms: {
        Args: Record<PropertyKey, never>
        Returns: { firm_id: string; name: string }[]
      }
      // The firm at an address, for a current member of it; null for anyone else.
      my_firm_at_address: {
        Args: { p_address: string }
        Returns: string | null
      }
      // A submission handed to a current member of its firm; the database writes the opening in the firm's record (20261116160001). No row for anyone else.
      open_submission: {
        Args: { p_session_id: string }
        Returns: Database["public"]["Tables"]["chamber_sessions"]["Row"][]
      }
      // A browser reporting a file it downloaded or built, or a sign-in; the firm and the person are worked out by the database.
      record_member_activity: {
        Args: { p_kind: string; p_record_id: string; p_record_type: string }
        Returns: undefined
      }
      // Renames a referral partner or changes its kind; the code never changes. A save names the version it started from (20261118160000):
      // a save that names none is refused (22023). The answer is {conflict: false, record} or {conflict: true, currentVersion, current, changed}.
      advisor_update_referral_partner: {
        Args: { p_code: string; p_name: string; p_kind: string; p_firm_id?: string | null; p_version?: number | null }
        Returns: Json
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
        Args: { p_extra_questions?: Json; p_fields?: string[]; p_message: string; p_session_id: string }
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
      // Accepts (records the status through the status function) or dismisses what a PEO's reply was suggested to mean (20261125100000).
      advisor_decide_reply_suggestion: {
        Args: { p_message_id: number; p_decision: "accept" | "dismiss" }
        Returns: Json
      }
      // An underwriter's open question asked of the employer, as an information request tied to the quote request (20261125120000).
      advisor_ask_about_question: {
        Args: { p_quote_request_id: number; p_message: string; p_fields?: string[]; p_extra_questions?: Json }
        Returns: Json
      }
      advisor_set_quote_request_status: {
        Args: { p_quote_request_id: number; p_status: string }
        Returns: Json
      }
      // A quote a PEO returned, the whole offer (20261124140000). Leave a cost area out and it stays "Not quoted"; an empty list or 0 is refused.
      record_quote: {
        Args: {
          p_admin_fee?: number | null
          p_admin_fee_basis?: string | null
          p_expires_on?: string | null
          p_kind: string
          p_medical?: Json | null
          p_note?: string | null
          p_one_off_fees?: Json | null
          p_quote_request_id: number
          p_received_on?: string | null
          p_start_on?: string | null
          p_unemployment?: Json | null
          p_workers_comp?: Json | null
        }
        Returns: Json
      }
      // Names a stored mail file of the quote request as a quote's document (20261125090000); the quote, as a row.
      attach_quote_document: {
        Args: { p_attachment_id: number; p_quote_id: number }
        Returns: Json
      }
      // Starts the upload of a quote document recorded by hand (20261125090000): a hand-made message with one pending attachment. Answers { attachment_id, message_id, folder }.
      start_quote_document_upload: {
        Args: { p_content_type: string; p_file_name: string; p_quote_id: number; p_size_bytes: number }
        Returns: Json
      }
      advisor_update_quote_request: {
        Args: {
          p_admin_fee_pepm?: number | null
          p_decline_reason?: string | null
          p_decline_words?: string | null
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
      // Sending the bundle to a PEO (M-2.1, 20261122140000): the send records the message queued and answers {quote_request_id, message_id};
      // 42501, PT423, PT404, 22023 (not authorized, answers changed since certifying, stage, addresses, subject and note), PT412 no mailbox.
      send_to_peo: {
        Args: { p_session_id: string; p_peo: string; p_to: string[]; p_subject: string; p_note: string }
        Returns: Json
      }
      // M-2.3: the newer certified version to a PEO holding an older one, on its thread; send_to_peo's every check, then what changed under the note.
      send_peo_update: {
        Args: { p_session_id: string; p_peo: string; p_to: string[]; p_subject: string; p_note: string }
        Returns: Json
      }
      // Joins the bundle link to the message, which writes the fixed block under the note; PT404, PT409, 22023 for a link that isn't the message's.
      attach_peo_link: {
        Args: { p_message_id: number; p_link_id: number; p_token: string }
        Returns: Json
      }
      // ---- CRM-L2.1: a lead's page (20261122220000_lead_page.sql) ----
      // The page in one read: {lead, can_change, can_add, in_bin, can_reopen, stages, converted}; null for a lead the caller may not see.
      lead_page: {
        Args: { p_firm_id: string; p_lead_id: string }
        Returns: Json
      }
      // A page of the lead's calls, notes and tasks, newest first: {count, rows}; null for a lead the caller may not see.
      lead_activity: {
        Args: { p_firm_id: string; p_lead_id: string; p_filter?: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      // The firm's members a task on the lead can be for: {contacts: [], opportunities: [], people}.
      lead_activity_options: {
        Args: { p_firm_id: string; p_lead_id: string }
        Returns: Json
      }
      // The save of a lead's own fields from a version: {conflict: false, record} or the conflict answer. A saved change makes a New lead Working.
      update_lead: {
        Args: {
          p_lead_id: string
          p_name: string
          p_title?: string | null
          p_business?: string | null
          p_email?: string | null
          p_phone?: string | null
          p_city?: string | null
          p_state?: string | null
          p_employees?: number | null
          p_current_provider?: string | null
          p_note?: string | null
          p_owner_id?: string | null
          p_firm_id?: string | null
          p_version?: number | null
        }
        Returns: Json
      }
      // Not a fit with one reason from the short list; answers the lead's fields.
      mark_lead_not_fit: {
        Args: { p_lead_id: string; p_reason: string; p_firm_id?: string | null }
        Returns: Json
      }
      // Reopens a Not a fit lead: Working again; answers the lead's fields.
      reopen_lead: {
        Args: { p_lead_id: string; p_firm_id?: string | null }
        Returns: Json
      }
      // A call, a note or a task on a lead: {activity, follow_up}. A call on a New lead makes it Working.
      log_lead_activity: {
        Args: {
          p_kind: string
          p_lead_id: string
          p_at?: string | null
          p_outcome?: string | null
          p_body?: string | null
          p_title?: string | null
          p_due_on?: string | null
          p_for?: string | null
          p_follow_up_title?: string | null
          p_follow_up_due_on?: string | null
          p_follow_up_for?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      // ---- CRM-L2.2: converting a lead (20261122250000_convert_lead.sql) ----
      // The accounts that may be the same business as the lead, by the duplicate match, only those the caller may see: {matches: [{id, name, city, state, reasons}]}.
      lead_convert_context: {
        Args: { p_firm_id: string; p_lead_id: string }
        Returns: Json
      }
      // One step, all or none: the account (made, or p_account_id used), the contact, the opportunity; {account: {..., created}, contact | null, opportunity | null}.
      convert_lead: {
        Args: {
          p_lead_id: string
          p_account_id?: string | null
          p_make_contact?: boolean | null
          p_first_name?: string | null
          p_last_name?: string | null
          p_contact_email?: string | null
          p_contact_phone?: string | null
          p_make_opportunity?: boolean | null
          p_opportunity_name?: string | null
          p_target_start?: string | null
          p_firm_id?: string | null
        }
        Returns: Json
      }
      // ---- M-2.4: follow up and withdraw (20261122190000_follow_up_and_withdraw.sql) ----
      // A follow-up queued on the PEO's thread: {quote_request_id, message_id, version}; its fresh link is then joined by attach_peo_link.
      follow_up_peo: {
        Args: { p_quote_request_id: number; p_to: string[]; p_subject: string; p_note: string }
        Returns: Json
      }
      // Closes the quote request with its reason, revokes its link and queues the withdrawal: {quote_request_id, message_id}.
      withdraw_from_peo: {
        Args: { p_quote_request_id: number; p_to: string[]; p_subject: string; p_note: string; p_reason: string }
        Returns: Json
      }
      // set_submission_status to Won, Lost or Archived, and one withdrawal queued on each PEO still open: {message_ids}.
      close_submission_and_withdraw: {
        Args: { p_session_id: string; p_status: string; p_note: string | null; p_won_quote_request_id: number | null; p_subject: string; p_body: string }
        Returns: Json
      }
      // What the composer reads: {mailbox: {connected, address}, contacts: [{name, role, email}], reply_address}.
      peo_send_context: {
        Args: { p_session_id: string; p_peo: string }
        Returns: Json
      }
      peo_registered_elsewhere: {
        Args: { p_session_id: string }
        Returns: Json
      }
      peo_registration_statement: {
        Args: { p_firm_id?: string }
        Returns: Json
      }
      issue_bundle_link: {
        Args: { p_quote_request_id: number; p_version: number; p_folder: string; p_files: Json; p_open_items?: Json }
        Returns: Json
      }
      firm_public_name: {
        Args: { p_address: string }
        Returns: string | null
      }
      // A visitor on a firm's public link asks to be contacted (20261122230000, CRM-L1.2b).
      request_contact: {
        Args: { p_address: string; p_name: string; p_email?: string; p_phone?: string; p_business?: string; p_message?: string }
        Returns: string
      }
      // Whether the link at a firm address takes intakes now (20261123110000).
      firm_takes_intakes: {
        Args: { p_address: string }
        Returns: boolean
      }
      // A broker starts an intake for a client, enters answers, invites the client and reminds them (20261123120000, slice 5.3: P-2.2, P-2.4).
      start_broker_intake: {
        Args: { p_opportunity_id: string; p_firm_id?: string }
        Returns: Json
      }
      broker_may_enter_intake: {
        Args: { p_intake_id: string }
        Returns: boolean
      }
      intake_invite_status: {
        Args: { p_intake_id: string }
        Returns: Json
      }
      // The employer opens the link the firm sent: what the page shows before sign-in, and taking the intake over (20261123120000).
      peek_intake_invite: {
        Args: { p_token_hash: string; p_firm_address: string }
        Returns: { firm_name: string; contact_name: string | null; expires_at: string; invited_by_name: string | null }[]
      }
      accept_intake_invite: {
        Args: { p_token_hash: string; p_firm_address: string }
        Returns: Json
      }
      // Signing up a firm and its approval (20261116170000).
      sign_up_firm: {
        Args: { p_name: string; p_address: string }
        Returns: string
      }
      admin_firm_states: {
        Args: Record<PropertyKey, never>
        Returns: {
          firm_id: string
          name: string
          address: string
          state: string
          signed_up_at: string
          suspended: boolean
          suspended_at: string | null
          suspension_reason: string | null
          closing_on: string | null
          closed_on: string | null
          closure_asked_at: string | null
          closure_asked_by: string | null
          closure_deleted: { [key: string]: number } | null
        }[]
      }
      // Closing a firm (20261118110000).
      request_firm_closure: {
        Args: { p_firm_id: string; p_firm_name: string }
        Returns: string
      }
      withdraw_firm_closure: {
        Args: { p_firm_id: string }
        Returns: undefined
      }
      my_firm_closure: {
        Args: { p_firm_id: string }
        Returns: { asked_at: string | null; closes_at: string | null; can_ask: boolean; cannot_ask_because: string | null }[]
      }
      admin_stop_firm_closure: {
        Args: { p_firm_id: string; p_reason: string }
        Returns: undefined
      }
      // Help from Nevermore (20261118120000).
      start_support_session: {
        Args: { p_firm_id: string; p_reason: string }
        Returns: { session_id: string; firm_name: string; firm_address: string; ends_at: string }[]
      }
      end_support_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      my_support_session_here: {
        Args: Record<PropertyKey, never>
        Returns: { session_id: string; firm_id: string; firm_name: string; firm_address: string; ends_at: string; ended_at: string | null; is_open: boolean; second_factor_pending: boolean }[]
      }
      admin_support_sessions: {
        Args: Record<PropertyKey, never>
        Returns: {
          session_id: string
          firm_id: string
          firm_name: string
          firm_address: string
          admin_email: string
          reason: string
          started_at: string
          ends_at: string
          ended_at: string | null
          ended_how: string | null
          is_open: boolean
          is_mine: boolean
        }[]
      }
      firm_support_sessions: {
        Args: { p_firm_id: string }
        Returns: { session_id: string; reason: string; started_at: string; ends_at: string; ended_at: string | null }[]
      }
      is_support_session: {
        Args: { p_firm_id: string }
        Returns: boolean
      }
      support_reads_firm: {
        Args: { p_firm_id: string }
        Returns: boolean
      }
      refuse_support_session: {
        Args: { p_firm_id: string }
        Returns: undefined
      }
      admin_suspend_firm: {
        Args: { p_firm_id: string; p_reason: string }
        Returns: undefined
      }
      admin_lift_firm_suspension: {
        Args: { p_firm_id: string }
        Returns: undefined
      }
      my_suspended_firm_at_address: {
        Args: { p_address: string }
        Returns: boolean
      }
      admin_waiting_firms: {
        Args: Record<PropertyKey, never>
        Returns: {
          firm_id: string
          name: string
          address: string
          signed_up_by_email: string | null
          signed_up_at: string
        }[]
      }
      admin_decide_firm: {
        Args: { p_firm_id: string; p_approve: boolean; p_note?: string | null }
        Returns: undefined
      }
      // Invitations to join a firm (20261116190000). The token's hash is asked of, and never returned by, the database.
      firm_role: {
        Args: { p_firm_id: string }
        Returns: string | null
      }
      firm_pending_invitations: {
        Args: { p_firm_id: string }
        Returns: {
          invitation_id: string
          email: string
          role: string
          team_id: string | null
          invited_at: string
          expires_at: string
          expired: boolean
          resent_at: string | null
          email_sent_at: string | null
          email_error: string | null
          email_outcome: string | null
        }[]
      }
      cancel_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      // Join by organisation (20261118100000). The two tables are closed to the API; an owner reaches them through these.
      add_firm_organisation: {
        Args: { p_firm_id: string; p_provider: string; p_org_id: string; p_label: string }
        Returns: Json
      }
      firm_organisations: {
        Args: { p_firm_id: string }
        Returns: { id: string; provider: string; org_id: string; label: string; added_at: string }[]
      }
      remove_firm_organisation: {
        Args: { p_id: string }
        Returns: undefined
      }
      // 'asked' or 'none': the same none for everyone who is not from an organisation the firm lists.
      ask_to_join_firm: {
        Args: { p_firm_address: string }
        Returns: string
      }
      firm_join_requests: {
        Args: { p_firm_id: string }
        Returns: { request_id: string; email: string; asked_at: string; provider: string; org_label: string }[]
      }
      // Returns the role the person now holds.
      approve_join_request: {
        Args: { p_request_id: string; p_role: string }
        Returns: string
      }
      decline_join_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      leave_firm: {
        Args: { p_firm_id: string }
        Returns: undefined
      }
      remove_member: {
        Args: { p_firm_id: string; p_user_id: string }
        Returns: undefined
      }
      suspend_member: {
        Args: { p_firm_id: string; p_user_id: string }
        Returns: undefined
      }
      lift_member_suspension: {
        Args: { p_firm_id: string; p_user_id: string }
        Returns: undefined
      }
      firm_members: {
        Args: { p_firm_id: string }
        Returns: {
          user_id: string
          email: string
          role: string
          state: string
          since: string
          is_you: boolean
        }[]
      }
      accept_invitation: {
        Args: { p_token_hash: string; p_firm_address: string }
        Returns: { firm_id: string; firm_address: string; role: string }[]
      }
      is_member_of_firm_address: {
        Args: { p_address: string }
        Returns: boolean
      }
      advisor_needs_second_factor: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      second_factor_rule_met: {
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
      // M-1.1 (20261122100000): the employer authorizes or withdraws a PEO on their own intake; each PEO's state for the employer or the intake's firm.
      set_peo_authorization: {
        Args: { p_session_id: string; p_peo: string; p_authorized: boolean; p_version: string; p_text: string }
        Returns: Json
      }
      peo_authorization_states: {
        Args: { p_session_id: string }
        Returns: { peo: string; state: string; signed_at: string | null; wording_version: string | null }[]
      }
      peo_authorization_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      // CRM-P2.5 (20261123200000): the employer ends a firm's access to their own intake; the firm that sees each of the caller's own intakes.
      employer_end_firm_access: {
        Args: { p_session_id: string }
        Returns: Json
      }
      my_intake_firms: {
        Args: Record<PropertyKey, never>
        Returns: { session_id: string; firm_name: string; company: string | null; invited_by_name: string | null; invited_at: string | null }[]
      }
      prospect_submission_status: {
        Args: { p_session_id: string }
        Returns: string | null
      }
      prospect_final_manuscript: {
        Args: { p_session_id: string }
        Returns: { version: number; storage_path: string; generated_at: string; corrections_applied: number }[]
      }
      // CRM-S3.3b: the queue's query (20261117100000_queue_query.sql). The page's shape is typed in src/lib/queueApi.ts.
      queue_list_submissions: {
        Args: {
          p_filters?: Json
          p_sort?: string | null
          p_direction?: string
          p_page?: number
          p_search?: string | null
          p_time_zone?: string
        }
        Returns: Json
      }
      // The numbers on the menu (20261118140000): { quotes, inbox } for the caller's current firm. Later stories add keys.
      menu_counts: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      queue_view_counts: {
        Args: { p_views: Json; p_search?: string | null; p_time_zone?: string }
        Returns: { view_name: string; total: number }[]
      }
      // The history of one record (20261118130000): newest first, for a current member of the record's firm (or a support session). The table is
      // closed to the API; this is the only way in. No id at all: who is a member's email, "Nevermore" or "System" (D-33, D-45).
      record_history_list: {
        Args: { p_firm_id: string; p_table: string; p_key: string; p_limit?: number; p_after_at?: string | null; p_after_key?: string | null }
        Returns: {
          at: string
          // 'quote_send' or 'quote_recorded' on a stage change a send or a quote made (ADR 0026), 'quote_taken' on a win (D-473); null otherwise.
          cause: string | null
          // The PEO of the quote request that caused it.
          cause_peo: string | null
          change_id: string
          entry_key: string
          field: string | null
          // The value before and after, as it was: a JSON string, number or boolean; null when there was no value.
          from_value: Json | null
          // 'created' (no field, no values), 'changed' (one field), 'stage_changed' (an opportunity's stage, field 'stage') or 'merged' (the record absorbed another, 20261121100000).
          kind: string
          // The name of the merged-away record an entry came from (copied in by a merge, or the 'merged' entry itself); null for every other entry.
          merged_from: string | null
          to_value: Json | null
          who: string
          // 'member', 'nevermore' or 'system'.
          who_kind: string
        }[]
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
      revoke_bundle_link: {
        Args: { p_quote_request_id: number; p_reason?: string }
        Returns: number
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
      // ---- CRM-S3.1b with S3.4b: column choices and saved views (20261117120000_table_settings.sql) ----
      // The tables saved_views and table_preferences are closed to the API; these functions are the only way in.
      list_saved_views: {
        Args: { p_firm_id: string; p_table: string }
        Returns: {
          view_id: string
          name: string
          filters: Json
          sort: Json | null
          columns: Json | null
          shared: boolean
          mine: boolean
          can_change: boolean
          can_share: boolean
          can_unshare: boolean
          updated_at: string
        }[]
      }
      save_view: {
        Args: { p_firm_id: string; p_table: string; p_name: string; p_filters: Json | null; p_sort: Json | null; p_columns: Json | null }
        Returns: string
      }
      rename_saved_view: {
        Args: { p_view_id: string; p_name: string }
        Returns: undefined
      }
      change_saved_view: {
        Args: { p_view_id: string; p_filters: Json | null; p_sort: Json | null; p_columns: Json | null }
        Returns: undefined
      }
      delete_saved_view: {
        Args: { p_view_id: string }
        Returns: undefined
      }
      share_saved_view: {
        Args: { p_view_id: string }
        Returns: undefined
      }
      unshare_saved_view: {
        Args: { p_view_id: string }
        Returns: undefined
      }
      my_table_columns: {
        Args: { p_firm_id: string; p_table: string; p_view_id?: string | null }
        Returns: { columns: Json | null; source: string }[]
      }
      set_my_table_columns: {
        Args: { p_firm_id: string; p_table: string; p_view_id: string | null; p_columns: Json | null }
        Returns: undefined
      }
      // ---- end CRM-S3.1b with S3.4b ----
      // ---- CRM-S1.2b (20261119230000_search_everywhere.sql) ----
      search_records: {
        Args: { p_firm_id: string; p_query?: string | null }
        Returns: Json
      }
      note_recent_record: {
        Args: { p_kind: string; p_id: string; p_firm_id?: string | null }
        Returns: boolean
      }
      my_recent_records: {
        Args: { p_firm_id?: string | null; p_limit?: number }
        Returns: Json
      }
      // ---- end CRM-S1.2b ----
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
