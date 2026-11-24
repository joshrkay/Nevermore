// What a firm needs before it can send (docs/BROKER_READINESS_PRD.md slice A; 20261127090000_sendable.sql): its own contacts at a PEO or carrier (BR-1.3),
// its requests for one that isn't listed and a platform admin's answer (BR-1.4), and its producer number and licences on record (BR-2.2). The database
// decides who may read or change each; a refusal it put into words is shown in those words.
import { supabase } from "@/integrations/supabase/client";
import { lineOf, type QuoteLine } from "@/data/lines";
import { AdvisorApiError } from "@/lib/advisorApi";

/** The codes whose message is a sentence written for the person: a rule broken, not theirs to do, not there, read-only, already done. */
const IN_WORDS = new Set(["22023", "42501", "PT404", "PT423", "55000"]);

function refusal(error: { code?: string; message?: string }, fallback: string): AdvisorApiError {
  return new AdvisorApiError(error.code && IN_WORDS.has(error.code) && error.message ? error.message : fallback, error.code);
}

const orNone = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);

// ---------- A firm's own contacts at a market ----------

export interface FirmMarketContact { id: number; peoId: number; peoName: string; name: string; role: string | null; email: string; phone: string | null; addedBy: string | null }
export interface NewMarketContact { name: string; role: string; email: string; phone: string }

interface ContactRow { id: number; peo_id: number; peo_name: string; name: string; role: string | null; email: string; phone: string | null; added_by: string | null }

/** The firm's contacts at every PEO and carrier, by market and then in the order added. */
export async function loadFirmMarketContacts(firmId: string): Promise<FirmMarketContact[]> {
  const { data, error } = await supabase.rpc("firm_market_contacts_list", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load your firm's contacts. Try again.");
  return ((data ?? []) as unknown as ContactRow[]).map((c) => ({
    id: c.id, peoId: c.peo_id, peoName: c.peo_name, name: c.name, role: c.role, email: c.email, phone: c.phone, addedBy: c.added_by,
  }));
}

export async function addFirmMarketContact(firmId: string, peoId: number, contact: NewMarketContact): Promise<void> {
  const { error } = await supabase.rpc("add_firm_market_contact", {
    p_firm_id: firmId, p_peo_id: peoId, p_name: contact.name.trim(), p_role: orNone(contact.role), p_email: contact.email.trim(), p_phone: orNone(contact.phone),
  });
  if (error) throw refusal(error, "That contact wasn't saved. Try again.");
}

export async function removeFirmMarketContact(firmId: string, contactId: number): Promise<void> {
  const { error } = await supabase.rpc("remove_firm_market_contact", { p_firm_id: firmId, p_contact_id: contactId });
  if (error) throw refusal(error, "That contact wasn't removed. Try again.");
}

// ---------- Asking for a market that isn't listed ----------

export type MarketRequestStatus = "open" | "listed" | "declined";
export interface MarketRequest {
  id: number;
  /** The asking firm's name: given to a platform admin, never to a firm (which reads only its own). */
  firmName: string | null;
  name: string;
  line: QuoteLine;
  contactName: string | null;
  contactEmail: string | null;
  note: string | null;
  status: MarketRequestStatus;
  answer: string | null;
  requestedBy: string | null;
  createdAt: string;
}
export interface NewMarketRequest { name: string; line: QuoteLine; contactName: string; contactEmail: string; note: string }

interface RequestRow {
  id: number; firm_name?: string | null; name: string; line?: string | null; contact_name: string | null; contact_email: string | null; note: string | null;
  status: MarketRequestStatus; answer: string | null; requested_by?: string | null; created_at: string;
}

const toRequest = (r: RequestRow): MarketRequest => ({
  id: r.id, firmName: r.firm_name ?? null, name: r.name, line: lineOf(r.line), contactName: r.contact_name, contactEmail: r.contact_email, note: r.note,
  status: r.status, answer: r.answer, requestedBy: r.requested_by ?? null, createdAt: r.created_at,
});

export async function requestMarket(firmId: string, request: NewMarketRequest): Promise<void> {
  const { error } = await supabase.rpc("request_market", {
    p_firm_id: firmId, p_name: request.name.trim(), p_line: request.line, p_contact_name: orNone(request.contactName), p_contact_email: orNone(request.contactEmail), p_note: orNone(request.note),
  });
  if (error) throw refusal(error, "Your request wasn't sent. Try again.");
}

/** The firm's own requests, newest first. */
export async function loadFirmMarketRequests(firmId: string): Promise<MarketRequest[]> {
  const { data, error } = await supabase.rpc("firm_market_requests", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load your firm's requests. Try again.");
  return ((data ?? []) as unknown as RequestRow[]).map(toRequest);
}

/** Every firm's requests, those waiting first. Platform admins only. */
export async function loadAdminMarketRequests(): Promise<MarketRequest[]> {
  const { data, error } = await supabase.rpc("admin_market_requests");
  if (error) throw refusal(error, "Couldn't load the requests. Try again.");
  return ((data ?? []) as unknown as RequestRow[]).map(toRequest);
}

/** A platform admin's one answer: listed, naming the market the request now is, or not, with the reason. */
export async function answerMarketRequest(requestId: number, answer: { listed: boolean; peoId: number | null; answer: string }): Promise<void> {
  const { error } = await supabase.rpc("admin_answer_market_request", {
    p_request_id: requestId, p_listed: answer.listed, p_answer: orNone(answer.answer), p_peo_id: answer.listed ? answer.peoId : null,
  });
  if (error) throw refusal(error, "That answer wasn't saved. Try again.");
}

// ---------- The firm's licences on record ----------

export type LicenceLine = "life_health" | "property_casualty";
export const LICENCE_LINE_LABELS: Record<LicenceLine, string> = { life_health: "Life and health", property_casualty: "Property and casualty" };

export interface FirmLicence { id: number; state: string; line: LicenceLine; licenceNumber: string | null; expiresOn: string | null; expired: boolean }
export interface FirmLicenceRecord {
  npn: string | null;
  licences: FirmLicence[];
  /** When a platform admin last recorded that they checked the record; null when never. */
  checkedAt: string | null;
  /** The record changed after that check, so the check covers what was there then. */
  changedSinceCheck: boolean;
  /** Whether the reader may change it: an owner of the firm. */
  canChange: boolean;
}
export interface NewFirmLicence { state: string; line: LicenceLine; licenceNumber: string; expiresOn: string }

interface RecordRow {
  npn: string | null;
  licences: { id: number; state: string; line: LicenceLine; licence_number: string | null; expires_on: string | null; expired: boolean }[];
  checked_at: string | null; changed_since_check: boolean; can_change?: boolean;
}

const toRecord = (r: RecordRow): FirmLicenceRecord => ({
  npn: r.npn,
  licences: (r.licences ?? []).map((l) => ({ id: l.id, state: l.state, line: l.line, licenceNumber: l.licence_number, expiresOn: l.expires_on, expired: l.expired })),
  checkedAt: r.checked_at, changedSinceCheck: r.changed_since_check, canChange: r.can_change === true,
});

export async function loadFirmLicenceRecord(firmId: string): Promise<FirmLicenceRecord> {
  const { data, error } = await supabase.rpc("firm_licence_record", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load your firm's licences. Try again.");
  return toRecord(data as unknown as RecordRow);
}

/** A firm's record as a platform admin reads it before approving the firm. */
export async function loadAdminFirmLicenceRecord(firmId: string): Promise<FirmLicenceRecord> {
  const { data, error } = await supabase.rpc("admin_firm_licence_record", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load the firm's licences. Try again.");
  return toRecord(data as unknown as RecordRow);
}

export async function setFirmNpn(firmId: string, npn: string): Promise<void> {
  const { error } = await supabase.rpc("set_firm_npn", { p_firm_id: firmId, p_npn: orNone(npn) });
  if (error) throw refusal(error, "The number wasn't saved. Try again.");
}

export async function addFirmLicence(firmId: string, licence: NewFirmLicence): Promise<void> {
  const { error } = await supabase.rpc("add_firm_licence", {
    p_firm_id: firmId, p_state: licence.state.trim(), p_line: licence.line, p_licence_number: orNone(licence.licenceNumber), p_expires_on: orNone(licence.expiresOn),
  });
  if (error) throw refusal(error, "That licence wasn't saved. Try again.");
}

export async function removeFirmLicence(firmId: string, licenceId: number): Promise<void> {
  const { error } = await supabase.rpc("remove_firm_licence", { p_firm_id: firmId, p_licence_id: licenceId });
  if (error) throw refusal(error, "That licence wasn't removed. Try again.");
}

/** A platform admin records that they checked the firm's licences as they stand now. */
export async function recordLicenceCheck(firmId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_record_licence_check", { p_firm_id: firmId });
  if (error) throw refusal(error, "The check wasn't recorded. Try again.");
}
