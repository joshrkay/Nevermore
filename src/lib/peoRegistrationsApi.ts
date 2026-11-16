// The registration record (Q-2.1) and the warning about a second submission (Q-2.2), slice 6.10; docs/BROKER_CRM_BUILD.md D-604, D-1630 to D-1639.
// Every send to a PEO writes a registration in the database (send_to_peo); the browser only reads: the PEOs another firm registered this intake's
// employer with, and when (never who), and the firm's own statement.
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";

/** A PEO another firm registered this employer with, and the first time it did. Nothing of which firm. */
export interface RegisteredElsewhere {
  peo: string;
  registered_at: string;
}

/** For an intake of the caller's own firm: each PEO another firm registered the same employer with. */
export async function loadRegisteredElsewhere(sessionId: string): Promise<RegisteredElsewhere[]> {
  const { data, error } = await supabase.rpc("peo_registered_elsewhere", { p_session_id: sessionId });
  if (error) throw new AdvisorApiError(error.message || "We couldn't check whether another firm registered this employer.");
  return (data as unknown as RegisteredElsewhere[]) ?? [];
}

/** One registration as the firm's statement gives it: the FEIN by its last four digits only, or null where the employer gave none. */
export interface StatementRow {
  registered_at: string;
  peo: string;
  employer: string | null;
  state: string | null;
  fein_last_four: string | null;
  file_id: string;
  version: number;
}

/** The firm's statement of its own registrations, oldest first, dated by the database. */
export interface RegistrationStatement {
  firm: string;
  as_of: string;
  rows: StatementRow[];
}

/** The statement of the firm the page acts for. A support session is refused (PT423), as for every download. */
export async function loadRegistrationStatement(firmId: string): Promise<RegistrationStatement> {
  const { data, error } = await supabase.rpc("peo_registration_statement", { p_firm_id: firmId });
  if (error) throw new AdvisorApiError(error.message || "We couldn't make the statement.", error.code);
  return data as unknown as RegistrationStatement;
}
